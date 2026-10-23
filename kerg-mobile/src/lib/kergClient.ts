/**
 * kergClient — reference TypeScript client for the Kerg Context Protocol (kerg/0.1).
 *
 * Embed in any phone app / dashboard. Flow:
 *   1. pair(robotUrl, code)          -> sync token (shown on the robot)
 *   2. push(layer, content, token)   -> signed update, robot re-aligns instantly
 *   3. subscribe(url, onEvent)       -> live alignment events over WebSocket
 */

export interface PairResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export interface SignedPayload {
  token: string;
  layer: string;
  content: string;
  ts: number;
  nonce: string;
  sig: string;
}

export interface PushResult {
  ok: boolean;
  version?: number;
  applied_ms?: number;
  error?: string;
}

export interface KergEvent {
  type: string;
  versions?: Record<string, number>;
  updated_layers?: string[];
  [k: string]: unknown;
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** HMAC-SHA256 over kerg wire payload — byte-for-byte identical to the agent. */
export async function signPayload(
  secret: string,
  layer: string,
  content: string,
  ts: number,
  nonce: string,
): Promise<string> {
  const wire = `${layer}|${content}|${ts}|${nonce}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(wire));
  return bytesToHex(sig);
}

export class KergClient {
  robotUrl: string;
  private _lastStatus: Record<string, unknown> | null = null;

  constructor(robotUrl: string) {
    this.robotUrl = robotUrl.replace(/\/+$/, "");
  }

  /** Exchange the 6-digit code shown on the robot for a sync token. */
  async pair(code: string): Promise<PairResult> {
    const resp = await fetch(`${this.robotUrl}/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return (await resp.json()) as PairResult;
  }

  /** Push a signed USER.md / SOUL.md update. Robot re-aligns immediately. */
  async push(layer: "soul" | "user", content: string, token: string): Promise<PushResult> {
    const ts = Math.floor(Date.now() / 1000);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const payload: SignedPayload & { sig: string } = {
      token,
      layer,
      content,
      ts,
      nonce,
      sig: await signPayload(token, layer, content, ts, nonce),
    };
    const resp = await fetch(`${this.robotUrl}/context/${layer}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) return { ok: false, error: String(data.error ?? resp.status) };
    return data as PushResult;
  }

  async status(): Promise<Record<string, unknown>> {
    const resp = await fetch(`${this.robotUrl}/status`);
    const data = (await resp.json()) as Record<string, unknown>;
    this._lastStatus = data;
    return data;
  }

  private async wsUrl(): Promise<string | null> {
    if (this._lastStatus?.ws_url) return String(this._lastStatus.ws_url);
    try {
      const s = (await this.status()) as any;
      return s.ws_url ?? null;
    } catch {
      return null;
    }
  }

  async currentContext(): Promise<{ prompt: string; versions: Record<string, number> }> {
    const resp = await fetch(`${this.robotUrl}/context`);
    return (await resp.json());
  }

  /** Live events (WebSocket). Falls back to polling when ws unavailable. */
  subscribe(onEvent: (e: KergEvent) => void, onContextUpdate?: (prompt: string) => void): () => void {
    const cleanup: Array<() => void> = [];
    let lastVersions: Record<string, number> = {};
    let ws: WebSocket | null = null;

    const startPolling = () => {
      const timer = setInterval(() => {
        void this.currentContext()
          .then((c) => {
            if (JSON.stringify(c.versions) !== JSON.stringify(lastVersions)) {
              lastVersions = c.versions;
              onContextUpdate?.(c.prompt);
              onEvent({ type: "context_updated", versions: c.versions });
            }
          })
          .catch(() => undefined);
      }, 750);
      cleanup.push(() => clearInterval(timer));
    };

    let wsOpen = false;
    const connect = async () => {
      // Robot advertises its real WS endpoint via /status.ws_url; without
      // the sync extra installed we get null and fall back to polling.
      const resolved = await this.wsUrl();
      if (!resolved) return startPolling();
      ws = new WebSocket(resolved);
      // NOTE: addEventListener, not onopen/onmessage accessors — not all
      // implementations (Node/undici) honor those.
      ws.addEventListener("open", () => {
        wsOpen = true;
      });
      ws.addEventListener("message", (ev: MessageEvent) => {
        const data = JSON.parse(String(ev.data)) as KergEvent;
        if (data.type === "context_updated" && onContextUpdate) {
          void this.currentContext()
            .then((c) => onContextUpdate(c.prompt), () => undefined);
        }
        onEvent(data);
      });
      // async handshake failure -> polling within the grace window
      const grace = setTimeout(() => {
        if (!wsOpen) {
          ws?.close();
          ws = null;
          startPolling();
        }
      }, 600);
      cleanup.push(() => clearTimeout(grace));
      ws.addEventListener("error", () => {
        if (!wsOpen) {
          startPolling();
        }
      });
    };
    void connect().catch(() => startPolling());

    return () => {
      cleanup.forEach((fn) => fn());
      ws?.close();
    };
  }
}

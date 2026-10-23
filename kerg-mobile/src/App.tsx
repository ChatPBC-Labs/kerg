import { useEffect, useRef, useState } from "react";
import { KergClient, KergEvent } from "./lib/kergClient";
import DemoPage from "./playground/DemoPage";

type Mode = "align" | "playground";

const TEMPLATES: Record<"user" | "soul", string> = {
  user: `---
name: Alex
household: apartment, 2 adults
accessibility: hard of hearing - speak slowly, face me
preferences: vegan meals, jazz, EV charging updates
---
# USER.md
Facts about me. Update whenever my life changes.`,
  soul: `---
name: Nova
tone: calm, warm, direct
---
# SOUL.md
You are Nova, our home robot.
## Rules
- Never ignore the emergency stop.
- Ask before moving anything fragile.
- If I seem stressed, keep it brief and gentle.`,
};

type Tab = "soul" | "user";

export default function App() {
  const [robotUrl, setRobotUrl] = useState("http://127.0.0.1:7630");
  const [code, setCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("soul");
  const [mode, setMode] = useState<Mode>("playground");
  const [docs, setDocs] = useState<Record<Tab, string>>(TEMPLATES);
  const [events, setEvents] = useState<string[]>([]);
  const [prompt, setPrompt] = useState<string>("(pair with your robot to see live context)");
  const clientRef = useRef<KergClient | null>(null);

  const log = (msg: string) =>
    setEvents((prev) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...prev].slice(0, 12));

  const connect = async () => {
    const client = new KergClient(robotUrl);
    clientRef.current = client;
    try {
      const status = await client.status();
      log(`connected: ${status["robot_id"]} by ${status["manufacturer"]} (${status["model"]})`);
      ctx();
    } catch {
      log(`cannot reach robot at ${robotUrl}`);
    }
  };

  const pair = async () => {
    if (!clientRef.current) return;
    const res = await clientRef.current.pair(code.trim());
    if (res.ok && res.token) {
      setToken(res.token);
      log("paired. you can now push context.");
    } else {
      log(`pairing failed: ${res.error}`);
    }
  };

  const ctx = () => {
    const client = clientRef.current;
    if (!client) return;
    const stop = client.subscribe(
      (e: KergEvent) => {
        if (e.type === "context_updated") {
          log(`robot re-aligned (${(e.updated_layers ?? []).join("+") || "init"})`);
        }
      },
      (p) => setPrompt(p),
    );
    void client.currentContext().then((c) => setPrompt(c.prompt));
    return stop;
  };

  useEffect(() => {
    let stop: (() => void) | undefined;
    if (clientRef.current) stop = ctx();
    return () => stop?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = async (layer: Tab) => {
    const client = clientRef.current;
    if (!client || !token) return log("pair first");
    const res = await client.push(layer, docs[layer], token);
    log(res.ok ? `${layer} v${res.version} pushed, applied in ${res.applied_ms}ms` : `rejected: ${res.error}`);
    if (res.ok) void client.currentContext().then((c) => setPrompt(c.prompt));
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1 style={{ marginBottom: 2 }}>Kerg <span style={{ fontSize: 14, color: "#888" }}>align your robot</span></h1>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        {(["playground", "align"] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            style={{ fontWeight: mode === m ? "bold" : "normal" }}>
            {m === "playground" ? "3D Playground" : "Align a real robot"}
          </button>
        ))}
      </div>

      {mode === "playground" ? (
        <DemoPage />
      ) : (
      <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={robotUrl} onChange={(e) => setRobotUrl(e.target.value)} size={28} />
        <button onClick={connect}>Connect</button>
        <input placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} size={10} />
        <button onClick={pair} disabled={!clientRef.current}>Pair</button>
        <span style={{ color: token ? "#1a7f37" : "#888" }}>{token ? "paired" : "unpaired"}</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <div>
            {(["soul", "user"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ fontWeight: tab === t ? "bold" : "normal" }}>
                {t.toUpperCase()}.md
              </button>
            ))}
          </div>
          <textarea value={docs[tab]} onChange={(e) => setDocs({ ...docs, [tab]: e.target.value })}
            style={{ width: "100%", minHeight: 280, fontFamily: "monospace", fontSize: 13 }} />
          <button onClick={() => void push(tab)} disabled={!token}>
            Push to robot
          </button>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: "0 0 4px" }}>Live robot context</h3>
          <pre style={{ background: "#f4f4f4", padding: 8, minHeight: 280, fontSize: 11, whiteSpace: "pre-wrap" }}>{prompt}</pre>
        </div>
      </div>

        <h3 style={{ marginBottom: 4 }}>Events</h3>
        <ul style={{ fontSize: 12, paddingLeft: 16 }}>{events.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </>
      )}
    </div>
  );
}

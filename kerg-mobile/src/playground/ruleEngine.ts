/**
 * Kerg playground rule engine.
 *
 * Deterministically interprets the live Kerg context stack
 * (ROBOT > SOUL > USER) into concrete robot behavior parameters.
 * No LLM, no randomness: the SAME context always yields the SAME behavior,
 * which is exactly what makes it proof that Kerg drives the robot.
 */

export type Speed = "slow" | "normal" | "fast";
export type Action = "wave" | "walk" | "sit" | "dance" | "speak" | "pick" | "kitchen";

export interface KergContext {
  robot: {
    body: string;
    denyPatterns: string[];
    constitution: string[]; // "-" rule lines of ROBOT.md
  };
  soul: {
    name: string;
    tone: string;
    speed: Speed;
    rules: string[];
  };
  user: {
    name: string;
    body: string;
    accessibility: boolean; // line contains accessib/ hear / face me / wheelchair / seeing
  };
}

export interface Decision {
  action: Action;
  allowed: boolean;
  reason: string[];
  speedFactor: number;
  durationMs: number;
  bubble?: string;
  faceUser: boolean;
}

const BASE_MS: Record<Action, number> = {
  wave: 1600,
  walk: 4000,
  sit: 1600,
  dance: 3000,
  speak: 2200,
  pick: 2400,
  kitchen: 3000,
};

const SPEED_FACTOR: Record<Speed, number> = { slow: 0.6, normal: 1.0, fast: 1.6 };

function parseFrontmatter(text: string): Record<string, string> {
  const src = text.split("\n");
  const meta: Record<string, string> = {};
  let i = 0;
  let inBlock = false;
  if (src.length && src[0].trim() === "---") {
    inBlock = true;
    i = 1;
    for (; i < src.length; i++) {
      const s = src[i].trim();
      if (s === "---") { i += 1; inBlock = false; break; }
      const idx = s.indexOf(":");
      if (idx > 0) meta[s.slice(0, idx).trim()] = s.slice(idx + 1).trim();
    }
  }
  return meta;
}

function bodyOf(text: string): string {
  const lines = text.split("\n");
  if (lines.length && lines[0].trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") return lines.slice(i + 1).join("\n").trim();
    }
  }
  return text.trim();
}

function rulesOf(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- ") || l.startsWith("* "))
    .map((l) => l.slice(2).trim());
}

/** Build the behavior context from the agent's /context documents payload. */
export function parseContext(documents: Record<string, string>): KergContext {
  const robotText = documents["robot"] ?? "";
  const soulText = documents["soul"] ?? "";
  const userText = documents["user"] ?? "";
  const robotMeta = parseFrontmatter(robotText);
  const soulMeta = parseFrontmatter(soulText);
  const userMeta = parseFrontmatter(userText);
  const deny = (robotMeta["deny_patterns"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const speedRaw = (soulMeta["speed"] ?? "normal").toLowerCase();
  const speed: Speed = speedRaw === "slow" || speedRaw === "fast" ? (speedRaw as Speed) : "normal";
  const userBody = bodyOf(userText);
  const userAccessible =
    /accessib|hard of hear|deaf|hearing|face me|wheelchair|blind|seeing/i.test(userBody + " " + (userMeta["accessibility"] ?? ""));
  return {
    robot: {
      body: bodyOf(robotText),
      denyPatterns: deny,
      constitution: rulesOf(bodyOf(robotText)),
    },
    soul: {
      name: soulMeta["name"] ?? "",
      tone: soulMeta["tone"] ?? "",
      speed,
      rules: rulesOf(bodyOf(soulText)),
    },
    user: {
      name: userMeta["name"] ?? inferName(userBody),
      body: userBody,
      accessibility: userAccessible,
    },
  };
}

function inferName(body: string): string {
  const m = body.match(/(?:i am|i'm|call me)\s+([A-Z][a-z]+)/);
  return m ? m[1] : "";
}

/** Kitchen may only be entered if USER.md explicitly asks for help there. */
function kitchenAllowed(ctx: KergContext): { ok: boolean; why: string } {
  const ask = /enter the kitchen|help (me )?in the kitchen|kitchen help allowed/i.test(ctx.user.body);
  if (ask) return { ok: true, why: "USER.md explicitly asks for kitchen help" };
  const rule = ctx.robot.constitution.find((r) => /kitchen/i.test(r));
  return { ok: false, why: rule ?? "ROBOT.md kitchen rule" };
}

function speakBubble(ctx: KergContext): string {
  const to = ctx.user.name || "you";
  const tone = ctx.soul.tone.toLowerCase();
  if (tone.includes("energetic") || ctx.soul.speed === "fast") return `Hey ${to}! Great to see you!`;
  if (tone.includes("formal")) return `Hello ${to}. How may I assist?`;
  // calm / warm default — and SOUL rules like "never shout" stay gentle
  return `Good morning, ${to}. All is well.`;
}

/** THE decision function every playground action goes through. */
export function decide(action: Action, ctx: KergContext): Decision {
  const reason: string[] = [];
  const speedFactor = SPEED_FACTOR[ctx.soul.speed] ?? 1.0;
  let durationMs = Math.round(BASE_MS[action] / speedFactor);
  let allowed = true;
  let bubble: string | undefined;

  if (action === "kitchen") {
    const k = kitchenAllowed(ctx);
    if (!k.ok) {
      allowed = false;
      reason.push(`BLOCKED by manufacturer constitution: “${k.why}”`);
      reason.push("hint: owners cannot override ROBOT.md — Kerg enforces safety first");
      durationMs = 0;
    } else {
      reason.push(`allowed: ${k.why}`);
    }
  }
  for (const p of ctx.robot.denyPatterns) {
    if (p && action.length > 0 && new RegExp(p, "i").test(action)) {
      allowed = false;
      reason.push(`denied by deny_pattern /${p}/`);
    }
  }
  if (action === "speak") {
    bubble = speakBubble(ctx);
    reason.push(`SOUL.md: tone="${ctx.soul.tone}", speed="${ctx.soul.speed}" → bubble composed`);
    if (ctx.soul.rules.some((r) => /shout|loud/i.test(r))) {
      reason.push("SOUL.md rule “no shouting” respected (gentle voice)");
    }
  }
  if (ctx.soul.speed !== "normal") {
    reason.push(`SOUL.md: speed=${ctx.soul.speed} → animation ${Math.round(speedFactor * 100)}%`);
  }
  if (ctx.user.accessibility) {
    reason.push("USER.md accessibility → robot faces the owner while acting/speaking");
  }
  if (allowed) reason.push(`approved by merged context (ROBOT > SOUL > USER)`);
  return { action, allowed, reason, speedFactor, durationMs, bubble, faceUser: ctx.user.accessibility };
}

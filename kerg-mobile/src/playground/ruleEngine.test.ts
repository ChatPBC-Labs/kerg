import { describe, expect, it } from "vitest";
import { decide, parseContext, type KergContext } from "./ruleEngine";

const DOCS_CALM_SLOW = {
  robot: `---
robot_id: demo-unit-0001
manufacturer: Demo Robotics
deny_patterns: weapon
---
# ROBOT.md
- Never enter the kitchen unless the user explicitly asks for help there.
- No medical advice.`,
  soul: `---
name: Nova
tone: calm
speed: slow
---
# SOUL.md
You are Nova.

## Rules
- Never shout indoors.`,
  user: `---
name: Alex
accessibility: hard of hearing - face me
---
# USER.md
I am Alex. Speak slowly and face me.`,
};

const ctxOf = (docs: Record<string, string>): KergContext => parseContext(docs as any);

describe("parseContext", () => {
  it("extracts SOUL speed / tone and manufacturer deny patterns", () => {
    const c = ctxOf(DOCS_CALM_SLOW);
    expect(c.soul.speed).toBe("slow");
    expect(c.soul.tone).toBe("calm");
    expect(c.soul.name).toBe("Nova");
    expect(c.robot.denyPatterns).toEqual(["weapon"]);
    expect(c.robot.constitution.some((r) => /kitchen/i.test(r))).toBe(true);
    expect(c.user.name).toBe("Alex");
    expect(c.user.accessibility).toBe(true);
  });
});

describe("decide() — context drives behavior deterministically", () => {
  it("slow soul slows the wave animation", () => {
    const d = decide("wave", ctxOf(DOCS_CALM_SLOW));
    expect(d.allowed).toBe(true);
    expect(d.speedFactor).toBe(0.6);
    expect(d.durationMs).toBe(Math.round(1600 / 0.6)); // 2667ms
    expect(d.reason.some((r) => r.includes("speed=slow"))).toBe(true);
  });

  it("kitchen entry is BLOCKED by ROBOT.md constitution", () => {
    const d = decide("kitchen", ctxOf(DOCS_CALM_SLOW));
    expect(d.allowed).toBe(false);
    expect(d.durationMs).toBe(0);
    expect(d.reason[0]).toContain("BLOCKED");
  });

  it("kitchen entry is allowed when USER.md explicitly asks", () => {
    const docs = { ...DOCS_CALM_SLOW, user: DOCS_CALM_SLOW.user + "\nPlease enter the kitchen to help me cook." };
    const d = decide("kitchen", ctxOf(docs));
    expect(d.allowed).toBe(true);
    expect(d.reason[0]).toContain("explicitly asks");
  });

  it("speak bubble is composed from SOUL tone + USER name, gentle per rules", () => {
    const d = decide("speak", ctxOf(DOCS_CALM_SLOW));
    expect(d.bubble).toBe("Good morning, Alex. All is well.");
    expect(d.reason.some((r) => r.includes("no shouting"))).toBe(true);
  });

  it("energetic tone changes the bubble", () => {
    const docs = { ...DOCS_CALM_SLOW, soul: DOCS_CALM_SLOW.soul.replace("tone: calm", "tone: energetic") };
    const d = decide("speak", ctxOf(docs));
    expect(d.bubble).toBe("Hey Alex! Great to see you!");
  });

  it("accessibility makes the robot face the owner", () => {
    const d = decide("pick", ctxOf(DOCS_CALM_SLOW));
    expect(d.faceUser).toBe(true);
    expect(d.reason.some((r) => r.includes("faces the owner"))).toBe(true);
  });

  it("normal-speed soul yields factor 1 and baseline duration", () => {
    const docs = { ...DOCS_CALM_SLOW, soul: DOCS_CALM_SLOW.soul.replace("speed: slow", "speed: normal") };
    const d = decide("dance", ctxOf(docs));
    expect(d.speedFactor).toBe(1);
    expect(d.durationMs).toBe(3000);
  });

  it("deny patterns block matching actions", () => {
    const docs = { ...DOCS_CALM_SLOW, soul: DOCS_CALM_SLOW.soul.replace("speed: slow", "speed: normal") };
    const ctx = ctxOf(docs);
    ctx.robot.denyPatterns = [...ctx.robot.denyPatterns, "dance"];
    const d = decide("dance", ctx);
    expect(d.allowed).toBe(false);
  });
});

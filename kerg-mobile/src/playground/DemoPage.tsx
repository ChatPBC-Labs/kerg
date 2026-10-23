/**
 * 3D Playground — proves that Kerg drives behavior.
 * Edit SOUL.md / USER.md exactly as they would be pushed to the robot,
 * then fire actions: every one goes through the same deterministic
 * decide() the robot policy uses. No LLM, no tricks.
 */
import { useMemo, useRef, useState } from "react";
import { Robot3D, PlaygroundHandle } from "./Robot3D";
import { decide, parseContext, Action } from "./ruleEngine";
import { DEFAULT_ROBOT_MD, TEMPLATES } from "../lib/templates";

const ACTIONS: Action[] = ["wave", "walk", "sit", "dance", "speak", "pick", "kitchen"];

interface LogEntry {
  id: number;
  action: Action;
  ok: boolean;
  lines: string[];
}

export default function DemoPage() {
  const [soul, setSoul] = useState(TEMPLATES.soul);
  const [user, setUser] = useState(TEMPLATES.user);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [lastMsg, setLastMsg] = useState<string>("Pressing an action runs it through the merged Kerg context.");
  const robotRef = useRef<PlaygroundHandle>(null);
  const nextId = useRef(1);

  const ctx = useMemo(() => parseContext({ robot: DEFAULT_ROBOT_MD, soul, user }), [soul, user]);
  const speedPct = Math.round(ctx.soul.speed === "slow" ? 60 : ctx.soul.speed === "fast" ? 160 : 100);

  const fire = (action: Action) => {
    const d = decide(action, ctx);
    const entry: LogEntry = { id: nextId.current++, action, ok: d.allowed, lines: d.reason };
    setLog((prev) => [entry, ...prev].slice(0, 14));
    if (d.allowed) {
      setLastMsg(`${action} approved at ${speedPct}% speed`);
      robotRef.current?.play(d.action, {
        durationMs: d.durationMs,
        speedFactor: d.speedFactor,
        bubble: d.bubble,
        faceUser: d.faceUser,
      });
    } else {
      setLastMsg(`${action} BLOCKED by the robot's constitution`);
    }
  };

  const chip = (t: string) => (
    <span key={t} style={{ background: "#eef", borderRadius: 10, padding: "2px 8px", fontSize: 11 }}>{t}</span>
  );

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "stretch", flexWrap: "wrap" }}>
      <div style={{ flex: "0 1 340px", minWidth: 300, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <b style={{ fontSize: 13 }}>ROBOT.md</b>{" "}
          <span style={{ fontSize: 11, color: "#888" }}>manufacturer layer · read-only, owner cannot change</span>
          <pre style={{ background: "#f4f4f4", padding: 6, fontSize: 11, margin: "4px 0", whiteSpace: "pre-wrap" }}>
            {DEFAULT_ROBOT_MD}
          </pre>
        </div>
        <div>
          <b style={{ fontSize: 13 }}>SOUL.md</b>
          <textarea value={soul} onChange={(e) => setSoul(e.target.value)}
            style={{ width: "100%", minHeight: 110, fontFamily: "monospace", fontSize: 12 }} />
        </div>
        <div>
          <b style={{ fontSize: 13 }}>USER.md</b>
          <textarea value={user} onChange={(e) => setUser(e.target.value)}
            style={{ width: "100%", minHeight: 110, fontFamily: "monospace", fontSize: 12 }} />
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 320, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ flex: 1, minHeight: 420, position: "relative", background: "#12161c", borderRadius: 10, overflow: "hidden" }}>
          <Robot3D ref={robotRef} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {ACTIONS.map((a) => (
            <button key={a} onClick={() => fire(a)} style={{ textTransform: "capitalize" }}>{a}</button>
          ))}
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {chip(`persona: ${ctx.soul.name || "(unnamed)"}`)}
            {chip(`tone: ${ctx.soul.tone || "(none)"}`)}
            {chip(`speed: ${ctx.soul.speed} (${speedPct}%)`)}
            {chip(ctx.user.accessibility ? `faces ${ctx.user.name || "owner"}` : "no accessibility flags")}
          </div>
        </div>

        <div style={{ fontSize: 12, color: lastMsg.includes("BLOCKED") ? "#b42318" : "#1a7f37" }}>{lastMsg}</div>

        <ul style={{ fontSize: 11, paddingLeft: 14, maxHeight: 150, overflowY: "auto", margin: 0 }}>
          {log.map((e) => (
            <li key={e.id}>
              <b style={{ textTransform: "capitalize", color: e.ok ? "#1a7f37" : "#b42318" }}>{e.action}</b>{" "}
              {e.ok ? "allowed" : "blocked"} — {e.lines.join(" · ")}
            </li>
          ))}
        </ul>

        <details style={{ fontSize: 11, color: "#555" }}>
          <summary>The safety proof (2 clicks)</summary>
          <ol style={{ margin: "4px 0" }}>
            <li>Press <i>kitchen</i> → blocked: ROBOT.md forbids the kitchen.</li>
            <li>Edit USER.md to add “Please help me in the kitchen” and press <i>kitchen</i> again → <b>still blocked</b>. Owners own personality; manufacturers own safety.</li>
          </ol>
        </details>
      </div>
    </div>
  );
}

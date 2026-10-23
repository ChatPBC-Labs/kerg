# Changelog

## 0.1.0 — first public release

- Context stack: `robot` (manufacturer, locked) > `soul > user` (owner) > `session`.
- Hot-reload: signed owner pushes re-align < 1 s, no reboot; versions per layer.
- Safety validation against ROBOT.md with deny-patterns and override heuristics.
- Pairing (6-digit code, single-use, TTL) + HMAC-SHA256 push signing.
- REST + events WebSocket + pairing CLI (`kerg-agent`).
- Reference owner dashboard (React/Vite TS) with editors and live context.
- ROS 2 adapter (`/kerg/context`), stdlib-only core.

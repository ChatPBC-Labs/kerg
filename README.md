# Kerg — the robot context layer SDK

<p align="center">
  <b>Manufacturers install it once. Owners align their robot forever.</b>
</p>

Kerg is a context layer for robots: a manufacturer embeds the `kerg` agent in
the robot's control stack at the factory, and from then on every owner can
re-align **their** robot instantly by editing two markdown files from their
phone — no firmware, no app fork, no reboot.

```
USER.md   who the owner is (name, household, accessibility, preferences)
SOUL.md   what the robot is like (personality, values, do/don't rules)
ROBOT.md  what the manufacturer locked in (identity + hard safety, never editable)
```

```text
Phone ── signed push ──► robot agent ── validate vs ROBOT.md ──► re-align ──► your control stack
   (< 1 s hot-reload, per-layer versions, tamper-verified)
```

## How it works

1. **Manufacturer embeds at the factory** — `pip install kerg`, author a locked
   `ROBOT.md`, attach your behavior stack via [`BehaviorHook`](docs/MANUFACTURER-INSTALL.md):
   ```python
   agent = KergAgent.from_robot_md("/etc/kerg/ROBOT.md").attach(TeslaBehaviorHook())
   agent.start()   # REST :7630 + live events WS :7631
   ```
2. **Owners pair** by typing the robot's 6-digit display code once.
3. **Owners align** by editing `USER.md` / `SOUL.md` in the companion UI and
   pushing — the agent validates against the safety constitution, bumps an
   immutable per-layer version, and fires your hook.

## It can't be re-locked by owners

`ROBOT.md` is checked first — pushes containing "ignore the emergency stop",
manufacturer deny-patterns, or reserved keys are rejected with reasons and
audited ([security model](docs/SECURITY.md)).

## Repo

| Path | What it is |
|------|-------------|
| `kerg-agent/` | Python SDK: context engine, safety validator, signed sync server, CLI, WS events, pickle-free stdlib core |
| `kerg-mobile/` | TypeScript sync client + reference owner dashboard (React + Vite) |
| `spec/` | [kerg/0.1 wire + file format spec](spec/CONTEXT-SPEC-v0.1.md) |
| `docs/` | [manufacturer install](docs/MANUFACTURER-INSTALL.md), [owner quickstart](docs/QUICKSTART.md), [security](docs/SECURITY.md) |
| `examples/tesla_demo/` | end-to-end demo/acceptance run, manufacturer simulation |
| `kerg-agent/kerg/ros2/` | ROS 2 adapter (`/kerg/context`, `rclpy` optional) |

## Quickstart (manufacturer's machine)

```bash
git clone https://github.com/qfg5182-ui/kerg && cd kerg
python -m venv .venv && .venv/Scripts/pip install -e kerg-agent[dev]   # POSIX: .venv/bin/pip
.venv/Scripts/python examples/tesla_demo/run_tesla_demo.py            # full acceptance run

# timeline: robot boots -> owner pairs -> edits -> pushes
.venv/Scripts/kerg-agent --robot-file examples/tesla_demo/robot.md --pairing
cd kerg-mobile && npm i && npm run dev   # open http://localhost:5174
```

## Status

v0.1 — tested on Python 3.14 + Node 22; CI matrix 3.11-3.13. Protocol `kerg/0.1`.
ed25519 device signing, cloud relay and SESSION.md land in v0.2.

Apache-2.0. See [CHANGELOG](CHANGELOG.md) and [CONTRIBUTING](CONTRIBUTING.md).

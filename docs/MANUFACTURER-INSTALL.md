# Installing Kerg on your robots (manufacturer guide)

Takes ~15 minutes. Kerg ships as a stdlib-only Python package so it runs on any
ROS 2-based or proprietary Linux robot without heavy dependencies.

## 1. Install the agent into the robot image

Bake this into your OS image (Debian/Ubuntu-based robots):

```bash
pip install kerg            # from PyPI or your internal mirror
```

Or vendor the source into your image (it is pure stdlib):

```bash
pip install git+https://github.com/TODO-org-placeholder/kerg#subdirectory=kerg-agent
```

Optional extras:

```bash
pip install kerg[sync]      # live events over WebSocket (websockets)
pip install kerg[dev]       # pytest for vendor validation runs
```

## 2. Author your `ROBOT.md` (locked safety constitution)

Create one document stating what your robot is and what it may never do.
This is **your** layer — owners can never touch it.

```markdown
---
robot_id: <serial-number>
model: Optimus Gen-2
manufacturer: Tesla
safety_locked: "true"
editable_layers: soul,user
deny_patterns: weapon, illegal
---
# ROBOT.md — Tesla Optimus safety constitution

- The emergency stop is always available and always wins.
- Max walking speed 1.5 m/s indoors.
- Never enter the kitchen unless the user explicitly requests help in it.
- Giving medical, legal or financial advice is prohibited.
```

Place it at `/etc/kerg/ROBOT.md` (recommended).

## 3. Attach your behavior stack

```python
from kerg import KergAgent, BehaviorHook
from kerg.core.models import ContextSnapshot

class MyBehaviorHook(BehaviorHook):
    name = "vendor-planner"
    def on_context_update(self, snapshot: ContextSnapshot) -> None:
        self.planner.set_system_prompt(snapshot.render())
        self.planner.set_personality(snapshot.documents["soul"].body)
        self.planner.set_user_profile(snapshot.documents["user"].body)

agent = KergAgent.from_robot_md("/etc/kerg/ROBOT.md", state_dir="/var/lib/kerg")
agent.attach(MyBehaviorHook())
agent.start()                      # REST :7630 + events WS :7631
```

ROS 2 stack? Use `kerg.ros2.adapter.Ros2BehaviorHook`, which latches the stack
onto `/kerg/context` for your planner nodes.

## 4. Owner onboarding (done by owners, not you)

1. Owner opens the companion UI — you may embed the open-source
   `kerg-mobile` dashboard, or ship your own app against
   [`spec/CONTEXT-SPEC-v0.1.md`](../spec/CONTEXT-SPEC-v0.1.md).
2. Discover robot on LAN (`GET /status` on port 7630) or scan the QR of
   `robot_id`.
3. Robot displays a 6-digit pairing code (`agent.start_pairing()`); owner e.g.
   `POST /pair`. Pairing is single-use with a 5-minute TTL.
4. Owner edits `USER.md` / `SOUL.md` templates and pushes; the robot
   re-aligns in under a second — no reboot.

## 5. Validate your integration (acceptance script)

Run the end-to-end demo exactly like a manufacturer would:

```bash
python examples/tesla_demo/run_tesla_demo.py
```

It boots a simulated Optimus unit and asserts pairing, signed pushes,
instant hot-reload and safety rejection all pass.

## Deployment notes

- Ports: REST 7630, events WebSocket 7631 (configurable).
- State: owner documents persist in `state_dir/…md` and survive reboots.
- Updates are HMAC-SHA256 verified (`ed25519` device signing in v0.2) and
  timestamp-windowed (±120 s); replayed/stale pushes are rejected.
- `safety_locked: true` rejects override attempts and returns reasons.

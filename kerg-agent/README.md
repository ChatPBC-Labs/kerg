# kerg — robot context-layer agent (Python package)

The `kerg` agent runs on the robot. Fork/monorepo README and docs:
https://github.com/qfg5182-ui/kerg

Install (manufacturer, into the robot OS image):

```bash
pip install kerg            # or: pip install kerg[sync]  (WebSocket events)
```

Boot with your locked manufacturer `ROBOT.md`:

```bash
kerg-agent --robot-file /etc/kerg/ROBOT.md --state-dir /var/lib/kerg --pairing
```

Owners then pair from their phone with the on-screen 6-digit code and push
`USER.md` / `SOUL.md`; the robot re-aligns in under a second.

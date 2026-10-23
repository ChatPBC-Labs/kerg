# Owner quickstart — align your robot in 2 minutes

Your robot manufacturer installed Kerg at the factory. You just give it
context about you and it aligns instantly.

## 1. Pair

- Run the robot's "show pairing code" action (or start `kerg-agent --pairing`),
  then open the dashboard:

```bash
cd kerg-mobile && npm run dev      # http://localhost:5174
```

- Enter the robot URL (default `http://<robot-ip>:7630`) and the 6-digit code.

## 2. Tell the robot who you are (`USER.md`)

Anything that changes how it should behave around you:

- name, household members, pets
- accessibility needs (hard of hearing, wheelchair, low vision)
- preferences (music, meals, sleep schedule, EV charging times)

## 3. Set its personality and rules (`SOUL.md`)

Name it, set the tone, and list rules — boundaries, chores, style.

## 4. Push

Hit **Push to robot**. It re-aligns in milliseconds and your change is
persistent across reboots. Every push is signed and versioned; attempts to
override safety constraints are rejected by the manufacturer's locked
`ROBOT.md` layer with reasons logged.

## Command line

```bash
kerg-agent --robot-file ROBOT.md --state-dir . --pairing
```

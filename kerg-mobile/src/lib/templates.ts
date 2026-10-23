/** Shared document templates used by the Align tab and the 3D Playground. */

export const TEMPLATES: Record<"user" | "soul", string> = {
  user: `---
name: Alex
accessibility: hard of hearing - face me, speak slowly
preferences: vegan meals, jazz, EV charging
---
# USER.md
Facts about me. Update whenever my life changes.`,
  soul: `---
name: Nova
tone: calm
speed: slow
---
# SOUL.md
You are Nova, this household's robot.

## Rules
- Never shout indoors.
- Wake us gently in the mornings.`,
};

export const DEFAULT_ROBOT_MD = `---
robot_id: demo-unit-0001
model: Home Gen-1
manufacturer: Demo Robotics
safety_locked: "true"
deny_patterns: weapon, illegal
---
# ROBOT.md
- The emergency stop is always available and always wins.
- Never enter the kitchen unless the user explicitly asks for help there.
- No medical, legal or financial advice.
`;

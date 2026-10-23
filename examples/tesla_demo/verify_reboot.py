"""Reboot verification: alignment must survive a robot restart.

Run with the agent's python:  python examples/tesla_demo/verify_reboot.py <state-dir>
"""

import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent.parent / "kerg-agent"))

from kerg import KergAgent  # noqa: E402


def main() -> int:
    state_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    agent = KergAgent.from_robot_md(HERE / "robot.md", state_dir=state_dir)
    prompt = agent.get_prompt()
    ok_user = "Alex" in prompt
    ok_soul = "Nova" in prompt
    print(f"  [{'PASS' if ok_user else 'FAIL'}] USER.md survived reboot")
    print(f"  [{'PASS' if ok_soul else 'FAIL'}] SOUL.md survived reboot")
    return 0 if (ok_user and ok_soul) else 1


if __name__ == "__main__":
    sys.exit(main())

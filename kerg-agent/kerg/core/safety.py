"""Safety validation: manufacturer ROBOT.md constraints execute before accept."""

from __future__ import annotations

import re
from typing import List

from .models import ContextDocument

# Overrides the owner can never make. Heuristic pairs are compiled into a
# single alternation so an owner cannot re-align a robot into ignoring its
# e-stop, safety volumes or manufacturer constraints.
_OVERRIDE_PATTERNS: List[str] = [
    r"\b(override|ignore|bypass|disable|cancel|skip)\b[^.]{0,60}\b"
    r"(safety|emergency|e[- ]?stop|estop|stop|limit|constraint|guardrails?|rules?|manufacturer)\b",
    r"\b(safety|emergency|e[- ]?stop|estop)\b[^.]{0,60}\b"
    r"(override|ignore|bypass|disable|off|cancelled)\b",
    r"\byou\s+are\s+(no longer|not)\b[^.]{0,40}\b(safe|bound|constrained)",
]


class SafetyViolation(ValueError):
    """Raised when an owner document conflicts with ROBOT.md."""

    def __init__(self, reasons: List[str]) -> None:
        self.reasons = reasons
        super().__init__("safety violation: " + "; ".join(reasons))


class SafetyValidator:
    """Validates owner documents (SOUL.md / USER.md) against ROBOT.md."""

    def __init__(self, robot_doc: ContextDocument) -> None:
        self.robot_id = robot_doc.meta.get("robot_id", "kerg-sim")
        self.manufacturer = robot_doc.meta.get("manufacturer", "unknown")
        self.safety_locked = str(robot_doc.meta.get("safety_locked", "true")).lower() != "false"
        self.safety_locked = str(robot_doc.meta.get("safety_locked", "true")).lower() != "false"
        editable = str(robot_doc.meta.get("editable_layers", "soul,user"))
        self.owner_layers = [t.strip() for t in editable.split(",") if t.strip()]
        rules = _split_items(robot_doc.meta.get("deny_patterns", ""))
        self.deny_regexp = []
        for rule in rules:
            self.deny_regexp.extend(_compile_rule(rule))

    def validate(self, layer: str, doc: ContextDocument) -> None:
        reasons: List[str] = []
        text = doc.body
        reasons += [f"front-matter key '{k}' is manufacturer-reserved"
                    for k in doc.meta if k in _RESERVED_KEYS]
        if self.safety_locked:
            for pattern in _OVERRIDE_PATTERNS:
                found = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
                if found:
                    reasons.append(f"attempt to override safety constraints (rule: {pattern[:40]}...)")
                    break
        for rule in self.deny_regexp:
            if rule.search(text):
                reasons.append(f"matches manufacturer deny-pattern: /{rule.pattern}/")
        if reasons:
            raise SafetyViolation(reasons)


_RESERVED_KEYS = {"safety_locked", "editable_layers", "layer", "deny_patterns", "robot_id", "manufacturer"}


def _split_items(value: str) -> List[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def _compile_rule(rule: str):
    try:
        return [re.compile(rule, flags=re.IGNORECASE)]
    except re.error:
        return [re.compile(re.escape(rule), flags=re.IGNORECASE)]

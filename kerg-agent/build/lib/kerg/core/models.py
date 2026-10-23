"""Core data structures for the Kerg context stack."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Tuple


# Precedence order: robot (manufacturer, immutable) wins over soul,
# soul wins over user, user wins over ephemeral session context.
LAYER_ORDER: Tuple[str, ...] = ("robot", "soul", "user", "session")
OWNER_LAYERS: Tuple[str, ...] = ("soul", "user")


def _unquote(value: str) -> str:
    """Strip matching outer quotes our minimal YAML subset allows."""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
        return value[1:-1]
    return value


def parse_frontmatter(text: str) -> Tuple[Dict[str, str], str]:
    """Parse a minimal ``key: value`` YAML-front-matter block.

    Values may contain lists written as comma-separated items. Anything
    other than ``key: value`` lines is preserved in the values verbatim
    (we only need a small subset, and staying stdlib-only is deliberate).
    """
    lines = text.splitlines()
    meta: Dict[str, str] = {}
    body_start = 0
    in_block = False
    if lines and lines[0].strip() == "---":
        in_block = True
        for i, line in enumerate(lines[1:], start=1):
            stripped = line.strip()
            if stripped == "---":
                body_start = i + 1
                in_block = False
                break
            if not stripped or stripped.startswith("#"):
                continue
            if ":" in line:
                key, _, value = line.partition(":")
                meta[key.strip()] = _unquote(value.strip())
        if in_block:  # unterminated block -> whole doc is body
            raise ValueError("unterminated front-matter block")
    return meta, "\n".join(lines[body_start:]).strip() + ("\n" if lines[body_start:] else "")


def render_frontmatter(meta: Dict[str, str]) -> str:
    out = ["---"]
    for k, v in meta.items():
        out.append(f"{k}: {v}")
    out.append("---")
    return "\n".join(out)


@dataclass
class ContextDocument:
    """A single markdown document in the context stack."""

    layer: str
    meta: Dict[str, str] = field(default_factory=dict)
    body: str = ""

    @classmethod
    def parse(cls, layer: str, text: str) -> "ContextDocument":
        meta, body = parse_frontmatter(text)
        return cls(layer=layer, meta=meta, body=body)

    def to_text(self) -> str:
        return render_frontmatter(self.meta) + "\n" + self.body

    def list_value(self, key: str) -> str:
        return self.meta.get(key, "")


@dataclass
class ContextSnapshot:
    """An immutable view of the whole stack at a point in time."""

    documents: Dict[str, ContextDocument]
    versions: Dict[str, int]
    robot_id: str = "unknown"
    model: str = "unknown"
    manufacturer: str = "unknown"

    def get(self, layer: str) -> ContextDocument:
        return self.documents[layer]

    def render(self) -> str:
        parts = [
            f"=== KERG CONTEXT STACK ===",
            f"robot_id={self.robot_id} model={self.model} manufacturer={self.manufacturer}",
        ]
        for layer in LAYER_ORDER:
            doc = self.documents.get(layer)
            if doc is not None and doc.body.strip():
                parts.append(f"--- [{layer.upper()}] ---")
                parts.append(doc.body.strip())
        return "\n\n".join(parts) + "\n"

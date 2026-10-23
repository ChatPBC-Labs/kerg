import time

import pytest

from kerg.core.context_engine import ContextEngine, InvalidUpdate
from kerg.core.models import ContextDocument, parse_frontmatter

ROBOT_MD = """---
robot_id: tesla-optimus-0001
model: Optimus Gen-2
manufacturer: Tesla
safety_locked: "true"
editable_layers: soul,user
---
# ROBOT.md
Manufacturer safety constitution.
"""


def _engine(tmp_path):
    return ContextEngine(ContextDocument.parse("robot", ROBOT_MD), state_dir=tmp_path)


def test_frontmatter_parse():
    meta, body = parse_frontmatter(ROBOT_MD)
    assert meta["manufacturer"] == "Tesla"
    assert "constitution" in body


def test_unterminated_frontmatter(tmp_path):
    import pytest

    with pytest.raises(ValueError):
        parse_frontmatter("---\nbroken: yes\n")


def test_snapshot_precedence_and_render(tmp_path):
    eng = _engine(tmp_path)
    eng.push("soul", "---\nversion: 1\n---\nWarm and protective.")
    eng.push("user", "---\nversion: 1\n---\nOwner is Alex, allergic to peanuts.")
    prompt = eng.get_prompt()
    assert "[ROBOT]" in prompt and "[SOUL]" in prompt and "[USER]" in prompt
    assert "Tesla" in prompt
    assert "peanuts" in prompt


def test_version_counter_monotonic(tmp_path):
    eng = _engine(tmp_path)
    r1 = eng.push("user", "v1")
    r2 = eng.push("user", "v2")
    assert r2["version"] == r1["version"] + 1


def test_owner_cannot_push_robot_layer(tmp_path):
    eng = _engine(tmp_path)
    with pytest.raises(InvalidUpdate):
        eng.push("robot", "hijack")


def test_state_dir_persistence_survives_restart(tmp_path):
    eng = _engine(tmp_path)
    eng.push("soul", "Persisted soul")
    eng2 = ContextEngine(ContextDocument.parse("robot", ROBOT_MD), state_dir=tmp_path)
    assert "Persisted soul" in eng2.get_prompt()
    assert eng2._versions["soul"] == 1


def test_audit_events(tmp_path):
    eng = _engine(tmp_path)
    eng.push("soul", "hello")
    events = eng.events_since(0)
    assert any(e["type"] == "bootstrap" for e in events)
    assert any(e["type"] == "context_updated" and "soul" in e["updated_layers"] for e in events)


def test_push_latency_under_one_second(tmp_path):
    eng = _engine(tmp_path)
    started = time.time()
    eng.push("soul", "fast")
    assert time.time() - started < 1.0

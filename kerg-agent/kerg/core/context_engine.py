"""The context engine: stores the stack, applies updates, triggers hooks."""

from __future__ import annotations

import copy
import json
import os
import threading
import time
from collections import deque
from pathlib import Path
from typing import Callable, Deque, Dict, List

from .hooks import BehaviorHook, CallableHook
from .models import OWNER_LAYERS, ContextDocument, ContextSnapshot, LAYER_ORDER
from .safety import SafetyValidator


class InvalidUpdate(ValueError):
    """Raised when an owner update is rejected."""


class ContextEngine:
    """Owns the four-layer context stack of one robot."""

    def __init__(self, robot_doc: ContextDocument, state_dir: str | os.PathLike | None = None) -> None:
        self._lock = threading.RLock()
        self._hooks: List[BehaviorHook] = []
        self._listeners: List[Callable[[dict], None]] = []
        self._event_log: Deque[dict] = deque(maxlen=256)
        self.safety = SafetyValidator(robot_doc)
        self._docs: Dict[str, ContextDocument] = {"robot": robot_doc}
        self._versions: Dict[str, int] = {"robot": int(robot_doc.meta.get("version", "1") or "1")}
        self._state_dir = Path(state_dir) if state_dir else None
        if self._state_dir:
            self._state_dir.mkdir(parents=True, exist_ok=True)
            self._load_saved(OWNER_LAYERS)
        self._boot_ts = time.time()
        self._dispatch(initial=True)

    # ---- persistence -------------------------------------------------
    def _load_saved(self, layers) -> None:
        for layer in layers:
            path = self._state_dir / f"{layer}.md"
            if path.is_file():
                try:
                    doc = ContextDocument.parse(layer, path.read_text(encoding="utf-8"))
                    self._docs[layer] = doc
                    self._versions[layer] = int(doc.meta.get("version", "1") or "1")
                except Exception:
                    continue  # corrupt state file: ignore, re-align from scratch

    def _persist(self, doc: ContextDocument) -> None:
        if self._state_dir:
            path = self._state_dir / f"{doc.layer}.md"
            tmp = path.with_suffix(".tmp")
            tmp.write_text(doc.to_text(), encoding="utf-8")
            os.replace(tmp, path)

    # ---- update path ---------------------------------------------------
    def push(self, layer: str, content: str) -> Dict:
        """Apply an owner update. Returns result dict, raises InvalidUpdate."""
        if layer not in OWNER_LAYERS:
            raise InvalidUpdate(f"layer '{layer}' is not owner-editable")
        started = time.perf_counter()
        doc = ContextDocument.parse(layer, content)
        with self._lock:
            self.safety.validate(layer, doc)
            version = self._versions.get(layer, 0) + 1
            doc.meta.setdefault("updated_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
            stale = self._docs.get(layer)
            on_rollback = None
            if stale is not None:
                on_rollback = stale.to_text()
            self._docs[layer] = doc
            self._versions[layer] = version
            doc.meta["version"] = str(version)  # persist across reboots
            try:
                self._persist(doc)
                snapshot = self._dispatch(changed=[layer])
            except Exception:
                if stale is not None and on_rollback is not None:
                    self._docs[layer] = stale
                    self._versions[layer] -= 1
                raise
        applied_ms = round((time.perf_counter() - started) * 1000, 2)
        return {"ok": True, "layer": layer, "version": version, "applied_ms": applied_ms,
                "snapshot": copy.deepcopy(snapshot)}

    def _dispatch(self, initial: bool = False, changed: List[str] | None = None) -> ContextSnapshot:
        with self._lock:
            snapshot = self.snapshot()
            event = {
                "type": "bootstrap" if initial else "context_updated",
                "versions": dict(self._versions),
                "updated_layers": changed or [],
                "ts": time.time(),
            }
            self._event_log.append(event)
            listeners = list(self._listeners)
            hooks = list(self._hooks)
        for listener in listeners:
            try:
                listener(event)
            except Exception:
                pass
        for hook in hooks:
            if initial:
                hook.on_start(snapshot)
            else:
                hook.on_context_update(snapshot)
        return snapshot

    # ---- snapshot ------------------------------------------------------
    def snapshot(self) -> ContextSnapshot:
        with self._lock:
            docs = {layer: copy.deepcopy(doc) for layer, doc in self._docs.items() if layer in LAYER_ORDER}
            meta = docs.get("robot", ContextDocument("robot")).meta
            robot_id = meta.get("robot_id") or "kerg-sim"
            return ContextSnapshot(
                documents=docs,
                versions=dict(self._versions),
                robot_id=robot_id,
                model=meta.get("model", "unknown"),
                manufacturer=meta.get("manufacturer", "unknown"),
            )

    def get_prompt(self) -> str:
        return self.snapshot().render()

    def status(self) -> dict:
        snap = self.snapshot()
        rs = self.safety
        return {
            "protocol": "kerg/0.1",
            "robot_id": snap.robot_id,
            "model": snap.model,
            "manufacturer": snap.manufacturer,
            "layers": {layer: self._versions.get(layer, 0) for layer in LAYER_ORDER},
            "safety_locked": rs.safety_locked,
            "uptime_s": round(time.time() - self._boot_ts, 1),
            "prompt_chars": len(self.get_prompt()),
        }

    # ---- hooks & events --------------------------------------------------
    def register_hook(self, hook) -> None:
        if not isinstance(hook, BehaviorHook):
            hook = CallableHook(hook)
        with self._lock:
            self._hooks.append(hook)

    def add_listener(self, fn: Callable[[dict], None]) -> None:
        with self._lock:
            self._listeners.append(fn)

    def remove_listener(self, fn) -> None:
        with self._lock:
            if fn in self._listeners:
                self._listeners.remove(fn)

    def events_since(self, index: int) -> List[dict]:
        with self._lock:
            return list(list(self._event_log)[index:])

    def export_json(self) -> str:
        snap = self.snapshot()
        return json.dumps(
            {
                "robot_id": snap.robot_id,
                "model": snap.model,
                "manufacturer": snap.manufacturer,
                "versions": snap.versions,
                "layers": {layer: doc.to_text() for layer, doc in snap.documents.items()},
            },
            indent=2,
        )

"""KergAgent - the single object a robot manufacturer embeds."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, List

from . import REST_PORT_DEFAULT, WS_PORT_DEFAULT
from .core.context_engine import ContextEngine, InvalidUpdate
from .core.hooks import BehaviorHook, CallableHook
from .core.models import ContextDocument
from .sync.pairing import PairingError, PairingManager
from .sync.server import KergSyncServer

__all__ = ["KergAgent", "BehaviorHook"]


def read_robot_md(path: str | os.PathLike) -> ContextDocument:
    return ContextDocument.parse("robot", Path(path).read_text(encoding="utf-8"))


class KergAgent:
    """Embed this in the robot's control stack at the factory.

    Example::

        agent = KergAgent.from_robot_md("/etc/kerg/ROBOT.md")
        agent.attach(TeslaBehaviorHook())
        agent.start()
    """

    def __init__(self, robot_md: ContextDocument, state_dir: str | os.PathLike | None = None) -> None:
        self.engine = ContextEngine(robot_md, state_dir)
        self.pairing = PairingManager()
        self._server: KergSyncServer | None = None

    @classmethod
    def from_robot_md(cls, path: str | os.PathLike, **kw) -> "KergAgent":
        return cls(read_robot_md(path), **kw)

    def attach(self, hook) -> "KergAgent":
        self.engine.register_hook(hook)
        return self

    def start_pairing(self) -> str:
        """Robot display shows this 6-digit code; owner types it in the app."""
        return self.pairing.start_pairing()

    def start(self, host: str = "0.0.0.0", rest_port: int = REST_PORT_DEFAULT,
              ws_port: int = WS_PORT_DEFAULT, block: bool = False):
        self._server = KergSyncServer(self, host=host, rest_port=rest_port, ws_port=ws_port)
        self._server.start(blocking=block)
        # deterministic start: REST is already serving; wait for the ws bind
        # (if any) so /status always advertises ws_url once start() returns
        self._server._ws_bound.wait(timeout=2.0)
        return self._server

    def stop(self) -> None:
        if self._server is not None:
            self._server.stop()

    # passthrough helpers ------------------------------------------------
    @property
    def status(self) -> dict:
        return self.engine.status()

    def get_prompt(self) -> str:
        return self.engine.get_prompt()

    def on_update(self, fn: Callable = None) -> None:
        self.engine.register_hook(fn)

    def events(self) -> List[dict]:
        return list(self.engine._event_log)

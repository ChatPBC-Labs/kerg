"""BehaviorHook - the manufacturer integration interface.

Robot manufacturers (Tesla, Figure, Unitree, ...) subclass
:class:`BehaviorHook` and register it with the agent. Every time an
owner re-aligns the robot, :meth:`on_context_update` fires on the
robot's own control/LLM stack.
"""

from __future__ import annotations

import abc

from .models import ContextSnapshot


class BehaviorHook(abc.ABC):
    """Contract every robot vendor adapter implements."""

    name: str = "behavior-hook"

    @abc.abstractmethod
    def on_context_update(self, snapshot: ContextSnapshot) -> None:
        """Called synchronously after each accepted context change."""

    def on_start(self, snapshot: ContextSnapshot) -> None:
        """Optional: called once when the agent bootstraps."""


class CallableHook(BehaviorHook):
    """Convenience wrapper for lambdas/callables."""

    def __init__(self, fn, name: str = "callable") -> None:
        self._fn = fn
        self.name = name

    def on_context_update(self, snapshot: ContextSnapshot) -> None:
        self._fn(snapshot)

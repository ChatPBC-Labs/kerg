"""Kerg - the robot context layer SDK.

Manufacturers embed Kerg on robots. Owners align their robot instantly
by pushing ``USER.md`` (who they are) and ``SOUL.md`` (personality/rules)
from their phone. A locked ``ROBOT.md`` authored by the manufacturer
holds safety constraints that can never be overridden.
"""

__version__ = "0.1.0"

PROTOCOL = "kerg/0.1"
REST_PORT_DEFAULT = 7630
WS_PORT_DEFAULT = 7631

from .agent import KergAgent  # noqa: E402

__all__ = ["KergAgent", "PROTOCOL", "__version__"]

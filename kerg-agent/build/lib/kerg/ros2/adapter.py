"""Optional ROS 2 adapter (publishes the whole context stack as a latched string)."""

from __future__ import annotations

from .hooks import BehaviorHook
from .models import ContextSnapshot

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String
    HAS_RCLPY = True
except ImportError:
    HAS_RCLPY = False


class Ros2BehaviorHook(BehaviorHook):
    """Requires a ROS 2 environment (``source /opt/ros/humble/setup.sh``)."""

    name = "ros2-adapter"

    def __init__(self, topic: str = "/kerg/context") -> None:
        if not HAS_RCLPY:
            raise RuntimeError("rclpy not available: source your ROS 2 setup.bash")
        rclpy.init()
        self.node = Node("kerg_context_bridge")
        self.pub = self.node.create_publisher(String, topic, 10)

    def on_context_update(self, snapshot: ContextSnapshot) -> None:
        msg = String()
        msg.data = snapshot.render()
        self.pub.publish(msg)

    def spin(self) -> None:
        rclpy.spin(self.node)

    def shutdown(self) -> None:
        self.node.destroy_node()
        rclpy.shutdown()

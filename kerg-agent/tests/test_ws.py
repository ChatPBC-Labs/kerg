import asyncio
import json
import threading
import time
import urllib.request

import pytest

ws = pytest.importorskip("websockets")

from kerg.agent import KergAgent
from kerg.core.models import ContextDocument

ROBOT_MD = """---
robot_id: ws-test-unit
model: WS Gen-1
manufacturer: Acme Robots
---
# ROBOT.md
"""


def test_ws_event_push_within_one_second(tmp_path):
    agent = KergAgent(ContextDocument.parse("robot", ROBOT_MD), state_dir=tmp_path)
    agent.start(host="127.0.0.1")
    assert agent._server._ws_bound.wait(timeout=3), "ws server did not bind"
    port = agent._server._ws_port_actual

    async def consume():
        import websockets

        async with websockets.connect(f"ws://127.0.0.1:{port}") as sock:
            bootstrap = json.loads(await sock.recv())
            assert bootstrap["type"] == "bootstrap"
            t0 = time.perf_counter()
            agent.engine.push("soul", "ws aligned soul")
            event = json.loads(await asyncio.wait_for(sock.recv(), timeout=1.5))
            return event, time.perf_counter() - t0

    got_event, elapsed = asyncio.new_event_loop().run_until_complete(consume())
    agent.stop()

    assert got_event["updated_layers"] == ["soul"]
    assert elapsed < 1.0

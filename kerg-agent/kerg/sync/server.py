"""REST + WebSocket sync server. Owners' phones talk to this."""

from __future__ import annotations

import json
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import TYPE_CHECKING

from .. import PROTOCOL
from ..core.models import OWNER_LAYERS
from ..core.signed import verify
from .pairing import PairingError

if TYPE_CHECKING:
    from ..agent import KergAgent

try:
    import websockets
    HAS_WS = True
except ImportError:  # pragma: no cover - optional extra
    websockets = None
    HAS_WS = False


class KergSyncServer:
    def __init__(self, agent: "KergAgent", host: str = "0.0.0.0",
                 rest_port: int = 7630, ws_port: int = 7631) -> None:
        self.agent = agent
        self.host = host
        self.rest_port = rest_port
        self.ws_port = ws_port
        self._httpd: ThreadingHTTPServer | None = None
        self._ws_task = None
        self._ws_loop = None
        self._ws_thread = None
        self._ws_bound = threading.Event()
        self._ws_port_actual: int | None = None
        self._stopped = threading.Event()

    # ---- lifecycle ------------------------------------------------------
    def start(self, blocking: bool = False) -> None:
        self._httpd = ThreadingHTTPServer((self.host, self.rest_port), _Handler)
        self._httpd.kerg = self
        self._httpd.daemon_threads = True
        self.bound_rest_port = self._httpd.server_address[1]
        self._rest_thread = threading.Thread(target=self._httpd.serve_forever, name="kerg-rest", daemon=True)
        self._rest_thread.start()
        if HAS_WS:
            self._start_ws()
        if blocking:
            self._stopped.wait()

    def _start_ws(self) -> None:
        import asyncio

        agent = self.agent
        loop = asyncio.new_event_loop()

        async def _handler(ws):
            await ws.send(json.dumps({"type": "bootstrap", **agent.engine.status()}))

            def listener(event):
                asyncio.run_coroutine_threadsafe(ws.send(json.dumps(event)), loop)

            agent.engine.add_listener(listener)
            # race-safety: replay the most recent event so changes made during
            # the handshake window (listener not yet attached) are never missed
            history = agent.engine.events_since(0)
            for past in reversed(history):
                if past.get("type") == "context_updated":
                    await ws.send(json.dumps(past))
                    break
            try:
                async for _ in ws:
                    pass  # client pings only; pushes go over REST
            except Exception:
                pass
            finally:
                agent.engine.remove_listener(listener)

        def _run() -> None:
            asyncio.set_event_loop(loop)

            async def _serve():
                async with websockets.serve(_handler, self.host, self.ws_port) as server:
                    sockets = getattr(server, "sockets", None) or []
                    if sockets:
                        self._ws_port_actual = sockets[0].getsockname()[1]
                    self._ws_bound.set()
                    await asyncio.Future()

            loop.run_until_complete(_serve())

        self._ws_thread = threading.Thread(target=_run, name="kerg-ws", daemon=True)
        self._ws_thread.start()

    def stop(self) -> None:
        self._stopped.set()
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()


def _json(handler: "_Handler", code: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "content-type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(body)


class _Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a) -> None:  # quiet
        pass

    def do_OPTIONS(self) -> None:
        _json(self, 204, {})

    def do_GET(self) -> None:
        kerg: KergSyncServer = self.server.kerg
        path = urllib.parse.urlparse(self.path).path
        if path in ("/status", "/", "/health"):
            status = {**kerg.agent.engine.status(), "ws_available": HAS_WS}
            if HAS_WS and kerg._ws_port_actual:
                host_header = self.headers.get("Host", "").split(":")[0] or "127.0.0.1"
                status["ws_url"] = f"ws://{host_header}:{kerg._ws_port_actual}"
            _json(self, 200, status)
        elif path == "/context":
            snap = kerg.agent.engine.snapshot()
            _json(self, 200, {
                "robot_id": snap.robot_id,
                "versions": snap.versions,
                "prompt": snap.render(),
                "documents": {layer: doc.to_text() for layer, doc in snap.documents.items()},
            })
        elif path == "/pair/refresh":
            _json(self, 200, {"pairing_code": kerg.agent.start_pairing()})
        else:
            _json(self, 404, {"error": "not found"})

    def do_POST(self) -> None:
        kerg: KergSyncServer = self.server.kerg
        path = urllib.parse.urlparse(self.path).path
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            _json(self, 400, {"error": "invalid json body"})
            return

        if path == "/pair":
            code = str(body.get("code", ""))
            try:
                token = kerg.agent.pairing.confirm(code)
                _json(self, 200, {"ok": True, "token": token})
            except PairingError as exc:
                _json(self, 403, {"ok": False, "error": str(exc)})
            return

        parts = path.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "context" and parts[1] in OWNER_LAYERS:
            layer = parts[1]
            token = str(body.get("token", ""))
            if not kerg.agent.pairing.is_valid(token):
                _json(self, 401, {"ok": False, "error": "unpaired: run /pair first"})
                return
            content = str(body.get("content", ""))
            ts = int(body.get("ts", 0))
            nonce = str(body.get("nonce", ""))
            sig = str(body.get("sig", ""))
            if abs(ts - time.time()) > 120:
                _json(self, 400, {"ok": False, "error": "stale timestamp"})
                return
            if not verify(token, layer, content, ts, nonce, sig):
                _json(self, 403, {"ok": False, "error": "invalid signature"})
                return
            try:
                result = kerg.agent.engine.push(layer, content)
            except Exception as exc:
                _json(self, 422, {"ok": False, "error": str(exc)})
                return
            snap = result.get("snapshot")
            if snap is not None:
                result["prompt"] = snap.render()
                del result["snapshot"]
            _json(self, 200, result)
        else:
            _json(self, 404, {"error": "not found"})

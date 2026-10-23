"""``kerg-agent`` command line entry point."""

from __future__ import annotations

import argparse
import sys

from . import REST_PORT_DEFAULT, WS_PORT_DEFAULT, __version__
from .agent import KergAgent


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="kerg-agent",
        description="Kerg robot context-layer daemon",
    )
    p.add_argument("--version", action="version", version=f"kerg {__version__}")
    p.add_argument("--robot-file", default="ROBOT.md", help="path to manufacturer ROBOT.md")
    p.add_argument("--state-dir", default=None, help="where owner documents are stored")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--rest-port", type=int, default=REST_PORT_DEFAULT)
    p.add_argument("--ws-port", type=int, default=WS_PORT_DEFAULT)
    p.add_argument("--pairing", action="store_true", help="start a pairing session at boot and print the code")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    agent = KergAgent.from_robot_md(args.robot_file, state_dir=args.state_dir)
    if args.pairing:
        code = agent.start_pairing()
        print(f"[kerg] pairing code: {code}")
    server = agent.start(host=args.host, rest_port=args.rest_port, ws_port=args.ws_port)
    print(f"[kerg] REST  http://{args.host}:{args.rest_port}/status")
    if server._ws_thread is not None:
        print(f"[kerg] WS    ws://{args.host}:{args.ws_port}")
    else:
        print("[kerg] WS    disabled (pip install websockets for live events)")
    try:
        while True:
            import time

            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[kerg] shutting down")
    return 0


if __name__ == "__main__":
    sys.exit(main())

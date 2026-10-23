"""Second-push helper: bumps SOUL.md to the next version with a proper UTF-8 signed push.

Usage: python examples/tesla_demo/second_push.py <pairing_code>
"""

import hashlib
import hmac
import json
import secrets
import sys
import time
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:7630"


def post(path: str, payload: dict):
    req = urllib.request.Request(
        f"{BASE}{path}", data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        return json.load(urllib.request.urlopen(req, timeout=5)), None
    except urllib.error.HTTPError as exc:
        return None, json.loads(exc.read() or b"{}")


def main() -> int:
    code = sys.argv[1]
    token = post("/pair", {"code": code})[0]["token"]
    content = Path(Path(__file__).parent / "soul.md").read_text(encoding="utf-8")
    ts, nonce = int(time.time()), secrets.token_hex(8)
    sig = hmac.new(token.encode(), f"soul|{content}|{ts}|{nonce}".encode(), hashlib.sha256).hexdigest()
    r, err = post("/context/soul", {"token": token, "layer": "soul", "content": content, "ts": ts, "nonce": nonce, "sig": sig})
    if r is not None:
        print(f"  [PASS] re-push accepted: soul v{r['version']} in {r['applied_ms']} ms")
        return 0
    print(f"  [FAIL] re-push rejected: {err}")
    return 1


if __name__ == "__main__":
    sys.exit(main())

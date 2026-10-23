"""HMAC-SHA256 signing for owner pushes (stdlib only; ed25519 lands in kerg/0.2)."""

from __future__ import annotations

import hashlib
import hmac
import secrets


def new_secret() -> str:
    return secrets.token_hex(32)


def sign(secret: str, layer: str, content: str, ts: int, nonce: str) -> str:
    payload = f"{layer}|{content}|{ts}|{nonce}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def verify(secret: str, layer: str, content: str, ts: int, nonce: str, sig: str) -> bool:
    return hmac.compare_digest(sign(secret, layer, content, ts, nonce), sig or "")

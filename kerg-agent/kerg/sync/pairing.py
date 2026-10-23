"""Owner pairing: 6-digit code displayed on the robot -> owner sync token."""

from __future__ import annotations

import secrets
import threading
import time

from ..core.signed import new_secret


class PairingError(ValueError):
    pass


class PairingManager:
    def __init__(self, code_ttl: float = 300.0) -> None:
        self._lock = threading.Lock()
        self._code: str | None = None
        self._code_ts: float = 0.0
        self._tokens: dict = {}
        self._ttl = code_ttl

    def start_pairing(self) -> str:
        with self._lock:
            self._code = f"{secrets.randbelow(900000) + 100000:06d}"
            self._code_ts = time.time()
            return self._code

    def confirm(self, code: str) -> str:
        with self._lock:
            if self._code is None:
                raise PairingError("no pairing session started")
            if time.time() - self._code_ts > self._ttl:
                self._code = None
                raise PairingError("pairing code expired, start a new session")
            if code != self._code:
                raise PairingError("invalid pairing code")
            token = new_secret()
            self._tokens[token] = time.time()
            self._code = None
            return token

    def is_valid(self, token: str) -> bool:
        with self._lock:
            return token in self._tokens

    def count(self) -> int:
        with self._lock:
            return len(self._tokens)

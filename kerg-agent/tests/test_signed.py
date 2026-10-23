"""HMAC signing must match between SDK (Python) and mobile client (TS)."""

from kerg.core.signed import new_secret, sign, verify


def test_sign_verify_roundtrip():
    secret = new_secret()
    payload = {"layer": "soul", "content": "hello", "ts": 1, "nonce": "n"}
    sig = sign(secret, **payload, )
    assert verify(secret, payload["layer"], payload["content"], payload["ts"], payload["nonce"], sig)


def test_wrong_secret_fails():
    sig = sign("secret-a", "soul", "hello", 1, "n")
    assert not verify("secret-b", "soul", "hello", 1, "n", sig)


def test_known_vector():
    # Known-answer vector asserted identically in TypeScript (kergClient.test.ts)
    assert sign("kerg-test-key", "soul", "hello", 1700000000, "nonce1") == \
        "98562d5bee4f3a4f3e2b096652061344d3e14f4ae30854d05985e8fb464ca8f5"

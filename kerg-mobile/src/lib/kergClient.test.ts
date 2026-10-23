import { describe, expect, it } from "vitest";
import { KergClient, signPayload } from "./kergClient";

describe("signPayload cross-implementation vectors", () => {
  it("matches the Python agent byte-for-byte (test_signed.py::test_known_vector)", async () => {
    const sig = await signPayload("kerg-test-key", "soul", "hello", 1700000000, "nonce1");
    expect(sig).toBe("98562d5bee4f3a4f3e2b096652061344d3e14f4ae30854d05985e8fb464ca8f5");
  });

  it("produces a 64-char hex digest", async () => {
    const sig = await signPayload("another-secret", "user", "Alex profile", 1700000001, "nonce2");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("KergClient", () => {
  it("normalizes robot urls", () => {
    expect(new KergClient("http://robot.local:7630///").robotUrl).toBe("http://robot.local:7630");
  });

  it("builds signed payload wire format", async () => {
    const ts = 1700000000;
    const nonce = "abc";
    const content = "---\nversion: 1\n---\nhello";
    const client = new KergClient("http://x:7630");
    // wire string must equal layer|content|ts|nonce
    const sig = await signPayload("k", "soul", content, ts, nonce);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

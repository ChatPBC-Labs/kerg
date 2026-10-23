# Security model

## Threat: owner re-locks the robot unsafely

The manufacturer's `ROBOT.md` is loaded from a manufacturer-protected path and
is not owner-editable. Every owner push is validated against it:

- reserved front-matter keys rejected;
- override heuristics (execute/disable/ignore × safety/estop/limits) rejected;
- manufacturer deny-pattern regexes rejected;
- rejections are audited with reasons and version survives unchanged.

## Threat: unpaired clients pushing

Pairing issues a 64-hex token; pushes must carry
`HMAC-SHA256(token, layer|content|ts|nonce)`.

- Wrong/absent pairing -> 401.
- Bad signature -> 403.
- Timestamp drift > ±120 s -> 400 (replay window).
- Per-layer monotonic version counters.

## Threat: sniffing

 LAN pairing exchanges codes once; the push token is long-lived and should be
stored in the owner app's secure storage. ed25519 device keys + TLS (secured
by the robot's own network stack or mTLS-terminating proxy) are the v0.2
upgrades; keys and protocol are designed to allow it without file-format
changes ([spec](../spec/CONTEXT-SPEC-v0.1.md)).

## Reporting

Open a GitHub issue tagged `security` — for the reference SDK. Manufacturers
should keep the REST ports on a dedicated VLAN / LAN-only, disable cloud
exposure, and rotate pairing codes carefully.

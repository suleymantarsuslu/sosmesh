# SOSMesh protocol v2 (multihop relay envelope)

Protocol version **2** defines the opaque store-carry-forward envelope used for Android multihop mesh (ADIM 40).

## Privacy and semantics

- `opaqueCiphertextBase64` is end-to-end ciphertext. **Relays MUST NOT decrypt or log plaintext SOS content.**
- `hopChainReceipt.relayDeviceIdHashes` stores **SHA-256 device id hashes only** (no GPS, no health data).
- `peerAckHint: PEER_RECEIVED_ONLY` when present reminds UIs that mesh peer ACK is **not** operator/rescue completion.

## iOS interop (ADIM 34 — not implemented here)

Field layout and golden vectors in `vectors/` are the cross-language contract for future iOS relay participation. Native iOS relay code lands in ADIM 34; until then, Android mesh v2 interoperates with Android peers only at the BLE application layer.

## Related code

| Location | Role |
|----------|------|
| `packages/contracts/src/protocol-v2/` | TypeScript relay engine (lab + CI) |
| `packages/contracts-kotlin/.../meshv2/` | Kotlin relay engine (Android + JVM tests) |
| `apps/android/mesh-v2/` | Android integration (queue, routing, handoff) |

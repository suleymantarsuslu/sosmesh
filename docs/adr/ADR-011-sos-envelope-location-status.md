# ADR-011: SOS envelope locationStatus (UNKNOWN / GPS / MANUAL)

## Status

Accepted (2026-10-31)  
**Amended (2026-11-03):** Privacy-focused location precision split

## Context

SOS messages expose a public `envelope` to relays and operators. When the device had no fix, Android composed `latitude: 0.0` and `longitude: 0.0`, which reads as a real position (Null Island) and violates the product rule that unknown location must be explicit.

Operators must also distinguish GPS fixes from user-entered coordinates.

### Amendment Context (2026-11-03)

BLE mesh relays can see the envelope in clear text. Precise GPS coordinates (~5-20m accuracy) in the envelope expose the sender's exact location to any relay operator. This creates privacy and safety risks, especially for domestic violence or stalking scenarios.

## Decision

1. Add required `envelope.locationStatus` with enum `UNKNOWN` | `GPS` | `MANUAL`.
2. When `locationStatus` is `UNKNOWN`, `envelope.location` MUST be JSON `null` (no coordinates on the wire).
3. When `locationStatus` is `GPS` or `MANUAL`, `envelope.location` MUST be a non-null object with `latitude` and `longitude`.
4. Apply the same fields in JSON Schema (`packages/contracts/schemas`), TypeScript validation, Kotlin `@Serializable` models, and Swift `Codable` models.
5. Android `SosMessageComposer` maps UI state: no fix → `UNKNOWN` + null location; device fix → `GPS`; manual entry → `MANUAL`.
6. Crypto AAD continues to bind envelope metadata; maps may include `locationStatus` and JSON `null` for `location` when unknown (golden vector `golden-001` unchanged — still GPS with coordinates).

### Amendment Decision (2026-11-03): Coarse Envelope + Precise Encrypted Payload

**Privacy Rule:** Precise GPS coordinates MUST travel ONLY in the encrypted inner payload. The public envelope visible to BLE relays carries coarse location.

7. **Envelope Location (public, visible to relays):**
   - Round `latitude` and `longitude` to 2 decimal places (~1.1 km precision at equator, ~550m at 60° latitude)
   - Clamp `accuracy` to minimum 1000 meters (or omit if unavailable)
   - This coarse location enables relay routing decisions without exposing precise sender position

8. **Inner Payload Location (encrypted, operators only):**
   - Contains full-precision `latitude`, `longitude`, `accuracy_meters`, and `timestamp`
   - Server decrypts and stores precise location in dedicated fields
   - Operators see precise coordinates with accuracy circle on map

9. **Backward Compatibility:**
   - Schema remains valid for legacy clients sending precise envelope coordinates
   - Server accepts both coarse and precise envelope locations
   - When decrypted inner payload contains location, server prefers it over envelope
   - Old messages without inner payload location fall back to envelope coordinates

10. **Implementation Requirements:**
    - Composers round envelope coordinates before AAD binding
    - Server `SosPlaintextSource` extracts precise location from decrypted payload
    - Operator API returns precise location when available, coarse otherwise (with `approximate: true` flag)
    - Web map shows ~1km accuracy circle for approximate locations, precise pin for decrypted locations
    - Never log coordinates in application logs, analytics, or crash reports

## Consequences

- Fixture and cross-language canonical JSON outputs include `locationStatus`.
- Legacy messages without `locationStatus` fail schema validation (protocol v1 forward-only in development).
- Release builds must not silently use dev-test crypto keys (see Android debug/release Hilt modules).
- **Amendment Consequences:**
  - BLE relays see only coarse ~1km location, preserving sender privacy
  - Operators with decryption keys see precise location for emergency response
  - Database must store both envelope (coarse) and decrypted (precise) locations
  - Backward compatibility maintained: old messages still accepted and processed

## References

- `packages/contracts/schemas/sos-message.schema.json`
- `packages/fixtures/protocol-v1/unknown-location-sos.json`
- Android: `SosMessageComposer`, `LocationSnapshot`
- iOS: `IosSosMessageComposer`, `SosLocationManager`
- Server: `SosPlaintextSource`, `envelope-location.ts`, operator API

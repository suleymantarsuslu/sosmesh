# ADR-011: SOS envelope locationStatus (UNKNOWN / GPS / MANUAL)

## Status

Accepted (2026-10-31)

## Context

SOS messages expose a public `envelope` to relays and operators. When the device had no fix, Android composed `latitude: 0.0` and `longitude: 0.0`, which reads as a real position (Null Island) and violates the product rule that unknown location must be explicit.

Operators must also distinguish GPS fixes from user-entered coordinates.

## Decision

1. Add required `envelope.locationStatus` with enum `UNKNOWN` | `GPS` | `MANUAL`.
2. When `locationStatus` is `UNKNOWN`, `envelope.location` MUST be JSON `null` (no coordinates on the wire).
3. When `locationStatus` is `GPS` or `MANUAL`, `envelope.location` MUST be a non-null object with `latitude` and `longitude`.
4. Apply the same fields in JSON Schema (`packages/contracts/schemas`), TypeScript validation, Kotlin `@Serializable` models, and Swift `Codable` models.
5. Android `SosMessageComposer` maps UI state: no fix → `UNKNOWN` + null location; device fix → `GPS`; manual entry → `MANUAL`.
6. Crypto AAD continues to bind envelope metadata; maps may include `locationStatus` and JSON `null` for `location` when unknown (golden vector `golden-001` unchanged — still GPS with coordinates).

## Consequences

- Fixture and cross-language canonical JSON outputs include `locationStatus`.
- Legacy messages without `locationStatus` fail schema validation (protocol v1 forward-only in development).
- Release builds must not silently use dev-test crypto keys (see Android debug/release Hilt modules).

## References

- `packages/contracts/schemas/sos-message.schema.json`
- `packages/fixtures/protocol-v1/unknown-location-sos.json`
- Android: `SosMessageComposer`, `LocationSnapshot`

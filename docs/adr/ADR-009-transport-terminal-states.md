# ADR-009: Transport terminal states FAILED and EXPIRED

## Status

Accepted (ADIM 10)

## Context

The delivery state chart progresses forward from `LOCAL_SAVED` through peer, server, and operator milestones. Real devices lose connectivity, TTLs elapse, and operators may reject malformed payloads. We need explicit terminal states without allowing backward transitions that would misrepresent delivery to the user.

## Decision

- Add **FAILED** when an unrecoverable send/validation error is recorded (`last_error` on the outbox row).
- Add **EXPIRED** when `expires_at` is reached (retention / policy); encrypted blob is purged on retention sweep.
- Neither state may transition to any other state.
- Invalid transitions (including any backward step on the progress chain) are rejected at the state machine layer in TS, Kotlin, and Swift using the shared fixture `packages/fixtures/transport/state-transitions.json`.

## Consequences

- UX labels exist only for the five progress states; terminal states use error/offline copy elsewhere.
- Room (Android) and on-device iOS queue behavior remain **NOT_TESTED** in CI; JVM SQLite and Linux Swift SQLite adapters validate persistence semantics only.

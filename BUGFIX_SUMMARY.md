# Production Bugfix Summary

## Bug 1: Incidents Invisible to Operators

### Problem
Operators with role `OPERATOR` or `COORDINATOR` could not see incidents that had no assignments. The `TenantScopeService.incidentWhere` method required incidents to have at least one assignment matching the operator's team/organization. However, ingest and demo endpoints create incidents without assignment rows, making them invisible to real operators.

### Root Cause
- Ingest creates incidents with zero assignment rows
- Demo endpoint creates incidents with zero assignment rows
- `incidentWhere` filter required `assignments.some({...})` condition
- Unassigned incidents were effectively hidden from the intake queue

### Fix
Updated `TenantScopeService.incidentWhere` to include unassigned incidents as part of the shared intake queue:

```typescript
OR: [
  { assignments: { some: { /* scoped filter */ } } },
  { assignments: { none: {} } }  // <-- NEW: unassigned incidents visible
]
```

Applied consistently to OPERATOR and COORDINATOR roles. ADMIN still sees everything (returns `undefined`).

### Secondary Fix
Added `ParseUUIDPipe` validation to `GET /v1/operator/cases/:incidentId` endpoint to return 400/404 for invalid UUIDs instead of 500.

### Impact
- All list/detail/stats/map/export paths using `incidentWhere` now show unassigned incidents
- Operators can see and triage newly ingested cases
- Dashboard stats correctly show `hasData: true` when unassigned incidents exist
- No visibility across organization boundaries (security preserved)

## Bug 2: Server-Key Decryption Fails (AAD Mismatch)

### Problem
Worker `ServerKeyPlaintextSource` failed to decrypt iOS-encrypted messages with `DECRYPTION_FAILED`. Triage jobs ended up in `requires_review` status with "No plaintext or transcript available".

### Root Cause
**AAD Mismatch**: iOS and Android clients encrypt with the full envelope as Associated Authenticated Data (AAD):
```json
{
  "timestamp": "2026-11-03T10:00:00.000Z",
  "locationStatus": "UNKNOWN",
  "location": null,
  "priority": 1
}
```

But the server reconstructed AAD with only:
```json
{
  "locationStatus": "UNKNOWN"
}
```

ChaCha20-Poly1305 AAD must match exactly between encryption and decryption, or authentication fails.

### Contract Verification
✅ **iOS** (`IosSosMessageComposer.swift:57-62`): Uses full envelope
✅ **Android** (`SosMessageComposer.kt:70-75`): Uses full envelope (buildEnvelopeMap)
✅ **Contract** (`crypto.ts:76-82`): createAAD expects envelope object
❌ **Server** (`sos-plaintext-source.ts:134-145`): Reconstructed partial envelope

### Fix

#### 1. Persist Original Envelope at Ingest
- Added `originalEnvelopeAad` column to `sos_messages` (nullable, TEXT)
- Ingest service stores `canonicalJSON(envelope)` from received message
- Migration: `20261103200000_fix_envelope_aad_persistence`

#### 2. Use Persisted Envelope for Decryption
- `ServerKeyPlaintextSource` reads `originalEnvelopeAad` from database
- Uses persisted envelope as AAD if present
- Falls back to legacy reconstruction for old rows (no data deletion)

#### 3. Requeue Script
Created `scripts/requeue-failed-triage.ts`:
- Idempotent: checks for existing pending/processing jobs before requeuing
- Operator-safe: only changes job status, never deletes data
- Targets `requires_review` jobs with "plaintext" in error message
- Supports `--dry-run` mode

Usage:
```bash
npm run requeue-failed-triage --dry-run  # preview
npm run requeue-failed-triage            # execute
```

### Impact
- New messages will decrypt successfully (AAD matches client encryption)
- Legacy messages (pre-fix) still attempt decryption with fallback logic
- Failed triage jobs can be safely requeued after deployment
- No plaintext, keys, or envelope contents logged

## Testing

### Unit Tests Added
1. **TenantScopeService** (`tenant-scope.service.spec.ts`)
   - ADMIN returns undefined
   - OPERATOR includes unassigned incidents
   - COORDINATOR includes unassigned incidents
   - Empty result when teamId/orgId missing

2. **OperatorPanelController** (`operator-panel.controller.spec.ts`)
   - Malformed UUID returns 400 BadRequest
   - Valid UUID accepted

3. **ServerKeyPlaintextSource** (`sos-plaintext-source.spec.ts`)
   - Decrypts with persisted original envelope AAD
   - Falls back to legacy reconstruction when AAD missing
   - Fails correctly when AAD doesn't match
   - Handles GPS location in envelope

### Manual Testing Required
- Verify operators can see unassigned incidents in dashboard
- Create demo SOS via `POST /v1/operator/demo/sos`
- Verify dashboard `hasData: true` and case list shows incident
- Test iOS/Android encryption round-trip in staging
- Run requeue script with `--dry-run` in production

## Migration

### Database
Migration `20261103200000_fix_envelope_aad_persistence`:
```sql
ALTER TABLE "sos_messages" ADD COLUMN "original_envelope_aad" TEXT;
```

**Production Steps:**
1. Deploy code changes
2. Run migration: `npx prisma migrate deploy`
3. (Optional) Run requeue script to retry failed triage jobs:
   ```bash
   cd apps/api
   npm run requeue-failed-triage --dry-run  # preview
   npm run requeue-failed-triage            # execute
   ```

### Rollback Plan
If issues arise, migration down.sql:
```sql
ALTER TABLE "sos_messages" DROP COLUMN IF EXISTS "original_envelope_aad";
```

Legacy decryption fallback remains in code, so old behavior is preserved for pre-migration rows.

## Security Notes
- No secrets in code or logs
- Envelope AAD does not contain plaintext (only metadata per contract)
- Unassigned incident visibility limited to OPERATOR/COORDINATOR within their org
- No cross-organization data leakage
- GPS coordinates in envelope are already public (relay-visible per ADIM 9)

## Files Changed
- `apps/api/src/organization/tenant-scope.service.ts` - Bug 1 fix
- `apps/api/src/operator/operator-panel.controller.ts` - UUID validation
- `apps/api/src/ingest/ingest.service.ts` - Persist envelope AAD
- `apps/api/src/ai/sos-plaintext-source.ts` - Use persisted AAD
- `apps/api/prisma/schema.prisma` - Add originalEnvelopeAad column
- `apps/api/prisma/migrations/20261103200000_fix_envelope_aad_persistence/` - Migration
- `apps/api/scripts/requeue-failed-triage.ts` - Requeue script
- `apps/api/src/organization/tenant-scope.service.spec.ts` - Tests
- `apps/api/src/operator/operator-panel.controller.spec.ts` - Tests
- `apps/api/src/ai/sos-plaintext-source.spec.ts` - Tests

## Deployment Notes
- No forced restarts required
- No data deletion
- Compatible with pre-fix messages (fallback logic)
- Run requeue script after deployment to retry failed jobs

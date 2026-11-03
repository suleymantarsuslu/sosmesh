# Schema Drift Analysis (Nov 3, 2026)

## Summary

Analysis of Prisma schema vs actual database schema after all migrations applied, following the fix for `Attachment.storageKey` mapping issue.

**Result**: No runtime-breaking drift found. All detected drift is cosmetic or vestigial.

## Drift Categories

### 1. Unused PostgreSQL Enums (NOT runtime-breaking)

Three enum types are defined in `schema.prisma` but:
- Never created in any migration
- Never used on any model field
- Never referenced in application code

```typescript
// schema.prisma defines these enums but NO fields use them:
enum AiJobStatus { PENDING, PROCESSING, COMPLETED, FAILED, REQUIRES_REVIEW, UNAVAILABLE }
enum AttachmentKind { AUDIO, PHOTO }
enum IncidentLinkStatus { SUGGESTED, CONFIRMED, REJECTED }
```

**Actual usage**:
- `AiJob.status` is `String` (values: `'pending'`, `'failed'`, `'completed'`)
- `AiJob.kind` is `String` (values: `'transcription'`, `'vision'`, etc.)
- `Attachment.kind` is `String` (values: `'photo'`, `'audio'`)
- `IncidentLinkSuggestion.status` is `String` (values: `'suggested'`, `'confirmed'`, `'rejected'`)

**Why not runtime-breaking**: Prisma generates code for String types, which works fine with VARCHAR columns. The enum types are vestigial definitions that have no effect.

**Verification performed**:
- ✅ Checked all model field types in schema
- ✅ Searched application code for enum references (zero matches)
- ✅ Confirmed string literals are used throughout codebase
- ✅ Verified attachments insert (`POST /v1/device/attachments`), AI job queue, and incident link operations work

**Recommendation**: Leave as-is. These definitions could be removed in a future cleanup, but removing them doesn't fix any bug or prevent any runtime issue.

### 2. VARCHAR vs TEXT Type Drift (cosmetic)

16 columns show drift between:
- Migrations: `VARCHAR(50)`, `VARCHAR(100)`, `VARCHAR(255)`, etc.
- Schema: `String` → maps to PostgreSQL `TEXT`

**Examples**:
```prisma
// Schema
status String
kind   String

// Migration created
status VARCHAR(50)
kind   VARCHAR(20)
```

**Why not runtime-breaking**: Prisma's String type works with both VARCHAR(N) and TEXT. Queries succeed. Values within VARCHAR limits work identically.

**Risk**: If future data exceeds VARCHAR limits, inserts would fail. However, current code already works, so this is existing behavior, not new breakage.

### 3. UUID Default Function (cosmetic)

5 models show:
- Migrations: `DEFAULT gen_random_uuid()`
- Schema: `@default(uuid())` (Prisma function)

**Why not runtime-breaking**: Both generate UUIDs. Drift detection sees "DROP DEFAULT" because Prisma's representation differs from the DB function, but the default still fires correctly.

### 4. Foreign Key ON UPDATE CASCADE (cosmetic)

9 foreign keys in tables created by `20261103102200_ai_foundation_p0_tables` lack `ON UPDATE CASCADE` in migrations but schema shows them.

**Why not runtime-breaking**: These are referenced UUID primary keys that never UPDATE. The ON UPDATE behavior is never exercised in practice.

### 5. TIMESTAMP vs TIMESTAMP(3) (cosmetic)

`sos_messages.precise_captured_at`:
- Migration: `TIMESTAMP`
- Schema: `DateTime?` (maps to `TIMESTAMP(3)`)

**Why not runtime-breaking**: Both store timestamps. The difference is sub-second precision (3 = milliseconds). Existing data is readable. New inserts work.

**Risk of fixing**: Altering the column type on production data could be risky if data exists with precision that doesn't match. Since it's not broken, leave it.

## Runtime Verification

Verified the following code paths work correctly despite drift:

1. **AI Job Queue** (`src/ai/ai-job-queue.service.ts`):
   - `WHERE status = 'pending'` queries work
   - Status updates `{ status: 'failed' }` work
   - No enum type errors

2. **Attachment Insert** (`POST /v1/device/attachments`):
   - Creates attachments with `kind: 'photo'` or `'audio'`
   - No enum type errors

3. **Incident Link Suggestions** (`src/operator/operator-fusion.controller.ts`):
   - Queries `WHERE status = 'suggested'`
   - Updates status to `'confirmed'` or `'rejected'`
   - No enum type errors

4. **Attachment Storage Key** (PR #107):
   - Fixed with `@map("storage_key")`
   - Case detail loading with attachments works

## Conclusion

**No migrations required.** All drift detected is either:
- Vestigial definitions (unused enums)
- Cosmetic type differences that don't affect runtime behavior
- Missing metadata (ON UPDATE CASCADE) that is never exercised

The schema works correctly as-is. The drift check script serves as a continuous monitoring tool to catch real issues like the `storageKey` mapping bug.

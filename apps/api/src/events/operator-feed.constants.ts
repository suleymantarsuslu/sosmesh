/**
 * pg_advisory_xact_lock key for operator feed first-accept inserts.
 * BIGSERIAL seq is allocated at INSERT time; without serialization, concurrent commits
 * can leave seq out of commit order so an SSE client that advanced past cursor N never
 * sees a later-committed row with seq < N. The transaction-scoped advisory lock forces
 * feed row allocation (and thus seq assignment) to run serially while keeping ingest work
 * parallel until the feed insert step.
 */
export const OPERATOR_FEED_ADVISORY_LOCK_KEY = 7788990019;

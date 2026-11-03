-- Rollback AI Foundation P0 tables migration
-- Work Package A - AI Foundation

-- Drop indexes on ai_analyses
DROP INDEX IF EXISTS "ai_analyses_status_idx";
DROP INDEX IF EXISTS "ai_analyses_urgency_idx";

-- Drop columns added to sos_messages
ALTER TABLE "sos_messages" DROP COLUMN IF EXISTS "synthetic";
ALTER TABLE "sos_messages" DROP COLUMN IF EXISTS "note_text";

-- Drop columns added to ai_analyses
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "operator_override";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "follow_up_questions";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "translation";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "source_quotes";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "next_step_suggestion";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "summary";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "missing_info";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "urgency_suggestion";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "hazards";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "needs";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "reported_person_count";
ALTER TABLE "ai_analyses" DROP COLUMN IF EXISTS "event_type";

-- Drop indexes on incident_link_suggestions
DROP INDEX IF EXISTS "incident_link_suggestions_pair_unique";
DROP INDEX IF EXISTS "incident_link_suggestions_status_idx";
DROP INDEX IF EXISTS "incident_link_suggestions_incident_b_idx";
DROP INDEX IF EXISTS "incident_link_suggestions_incident_a_idx";

-- Drop new tables
DROP TABLE IF EXISTS "incident_link_suggestions";
DROP TABLE IF EXISTS "ai_vision_analyses";
DROP TABLE IF EXISTS "ai_transcripts";
DROP TABLE IF EXISTS "attachments";
DROP TABLE IF EXISTS "ai_usage_ledger";
DROP TABLE IF EXISTS "ai_jobs";

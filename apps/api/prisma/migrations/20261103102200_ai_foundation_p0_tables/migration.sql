-- AI Foundation P0 Tables Migration
-- Meta AI Hackathon - Work Package A

-- AiJob: durable job queue with idempotency
CREATE TABLE "ai_jobs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "kind" VARCHAR(50) NOT NULL,
    "incident_id" UUID REFERENCES "incidents"("id") ON DELETE CASCADE,
    "sos_message_id" UUID REFERENCES "sos_messages"("id") ON DELETE CASCADE,
    "attachment_id" UUID,
    "idempotency_key" VARCHAR(255) NOT NULL UNIQUE,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3)
);

CREATE INDEX "ai_jobs_status_created_at_idx" ON "ai_jobs"("status", "created_at");
CREATE INDEX "ai_jobs_incident_id_idx" ON "ai_jobs"("incident_id");
CREATE INDEX "ai_jobs_sos_message_id_idx" ON "ai_jobs"("sos_message_id");

-- AiUsageLedger: daily budget tracking with real token/cost reconciliation
CREATE TABLE "ai_usage_ledger" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "day" DATE NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "reserved_usd" DECIMAL(10, 4) NOT NULL DEFAULT 0,
    "actual_usd" DECIMAL(10, 4) NOT NULL DEFAULT 0,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "request_id" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ai_usage_ledger_day_model_idx" ON "ai_usage_ledger"("day", "model");

-- Attachment: media storage (audio/photo)
CREATE TABLE "attachments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "incident_id" UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
    "sos_message_id" UUID REFERENCES "sos_messages"("id") ON DELETE SET NULL,
    "kind" VARCHAR(20) NOT NULL,
    "mime" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "duration_ms" INTEGER,
    "storage_key" VARCHAR(500) NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3)
);

CREATE INDEX "attachments_incident_id_idx" ON "attachments"("incident_id");
CREATE INDEX "attachments_sos_message_id_idx" ON "attachments"("sos_message_id");
CREATE INDEX "attachments_storage_key_idx" ON "attachments"("storage_key");
CREATE INDEX "attachments_expires_at_idx" ON "attachments"("expires_at");

-- AiTranscript: voice-to-text results
CREATE TABLE "ai_transcripts" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "attachment_id" UUID NOT NULL REFERENCES "attachments"("id") ON DELETE CASCADE,
    "model" VARCHAR(100) NOT NULL,
    "transcript" TEXT NOT NULL,
    "turns" JSONB NOT NULL DEFAULT '[]',
    "language" VARCHAR(10),
    "audio_duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ai_transcripts_attachment_id_key" ON "ai_transcripts"("attachment_id");

-- AiVisionAnalysis: Spark image + SAM segmentation results
CREATE TABLE "ai_vision_analyses" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "attachment_id" UUID NOT NULL REFERENCES "attachments"("id") ON DELETE CASCADE,
    "spark_summary" JSONB NOT NULL,
    "sam_results" JSONB NOT NULL DEFAULT '[]',
    "spark_model" VARCHAR(100) NOT NULL,
    "sam_model" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ai_vision_analyses_attachment_id_key" ON "ai_vision_analyses"("attachment_id");

-- IncidentLinkSuggestion: signal fusion / incident correlation
CREATE TABLE "incident_link_suggestions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "incident_a_id" UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
    "incident_b_id" UUID NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
    "score" DECIMAL(5, 4) NOT NULL,
    "deterministic_signals" JSONB NOT NULL,
    "ai_rationale" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'suggested',
    "decided_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "incident_link_suggestions_incident_a_idx" ON "incident_link_suggestions"("incident_a_id");
CREATE INDEX "incident_link_suggestions_incident_b_idx" ON "incident_link_suggestions"("incident_b_id");
CREATE INDEX "incident_link_suggestions_status_idx" ON "incident_link_suggestions"("status");
CREATE UNIQUE INDEX "incident_link_suggestions_pair_unique" ON "incident_link_suggestions"("incident_a_id", "incident_b_id");

-- Extend AiAnalysis with v2 triage fields (keeping existing columns for compatibility)
-- Add new columns for enhanced triage
ALTER TABLE "ai_analyses" ADD COLUMN "event_type" VARCHAR(50);
ALTER TABLE "ai_analyses" ADD COLUMN "reported_person_count" INTEGER;
ALTER TABLE "ai_analyses" ADD COLUMN "needs" JSONB DEFAULT '[]';
ALTER TABLE "ai_analyses" ADD COLUMN "hazards" JSONB DEFAULT '[]';
ALTER TABLE "ai_analyses" ADD COLUMN "urgency_suggestion" VARCHAR(20);
ALTER TABLE "ai_analyses" ADD COLUMN "missing_info" JSONB DEFAULT '[]';
ALTER TABLE "ai_analyses" ADD COLUMN "summary" TEXT;
ALTER TABLE "ai_analyses" ADD COLUMN "next_step_suggestion" TEXT;
ALTER TABLE "ai_analyses" ADD COLUMN "source_quotes" JSONB DEFAULT '[]';
ALTER TABLE "ai_analyses" ADD COLUMN "translation" JSONB;
ALTER TABLE "ai_analyses" ADD COLUMN "follow_up_questions" JSONB DEFAULT '[]';
ALTER TABLE "ai_analyses" ADD COLUMN "operator_override" JSONB;

-- Add SosMessage plaintext note fields (from user decision)
ALTER TABLE "sos_messages" ADD COLUMN "note_text" TEXT;
ALTER TABLE "sos_messages" ADD COLUMN "synthetic" BOOLEAN NOT NULL DEFAULT false;

-- Create index for AI status queries
CREATE INDEX "ai_analyses_status_idx" ON "ai_analyses"("status");
CREATE INDEX "ai_analyses_urgency_idx" ON "ai_analyses"("urgency_suggestion");

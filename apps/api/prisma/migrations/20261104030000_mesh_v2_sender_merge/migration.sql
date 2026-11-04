-- Mesh v2 (docs/protocol/mesh-v2.md §12): sender identity, person merge, latest encrypted profile.
-- Additive only: every new column is nullable or has a default; v1 rows are untouched.

CREATE TABLE "sos_senders" (
    "id" UUID NOT NULL,
    "sender_key_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sos_senders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sos_senders_sender_key_hash_key" ON "sos_senders"("sender_key_hash");

CREATE TABLE "sos_sender_profiles" (
    "sender_id" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "key_version" VARCHAR(16) NOT NULL,
    "source_seq" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sos_sender_profiles_pkey" PRIMARY KEY ("sender_id"),
    CONSTRAINT "sos_sender_profiles_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "sos_senders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "sos_messages"
  ADD COLUMN "sender_id" UUID,
  ADD COLUMN "inner_version" SMALLINT,
  ADD COLUMN "sender_seq" BIGINT;
ALTER TABLE "sos_messages"
  ADD CONSTRAINT "sos_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "sos_senders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "sos_messages_sender_id_received_at_idx" ON "sos_messages"("sender_id", "received_at" DESC);

ALTER TABLE "incidents"
  ADD COLUMN "sender_id" UUID,
  ADD COLUMN "latest_latitude" DECIMAL(10,7),
  ADD COLUMN "latest_longitude" DECIMAL(10,7),
  ADD COLUMN "latest_accuracy_meters" DOUBLE PRECISION,
  ADD COLUMN "latest_location_at" TIMESTAMP(3),
  ADD COLUMN "merged_message_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "last_message_at" TIMESTAMP(3);
ALTER TABLE "incidents"
  ADD CONSTRAINT "incidents_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "sos_senders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "incidents_sender_id_updated_at_idx" ON "incidents"("sender_id", "updated_at" DESC);

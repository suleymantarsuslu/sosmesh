-- Rollback for 20261104030000_mesh_v2_sender_merge
DROP INDEX IF EXISTS "incidents_sender_id_updated_at_idx";
ALTER TABLE "incidents" DROP CONSTRAINT IF EXISTS "incidents_sender_id_fkey";
ALTER TABLE "incidents"
  DROP COLUMN IF EXISTS "sender_id",
  DROP COLUMN IF EXISTS "latest_latitude",
  DROP COLUMN IF EXISTS "latest_longitude",
  DROP COLUMN IF EXISTS "latest_accuracy_meters",
  DROP COLUMN IF EXISTS "latest_location_at",
  DROP COLUMN IF EXISTS "merged_message_count",
  DROP COLUMN IF EXISTS "last_message_at";
DROP INDEX IF EXISTS "sos_messages_sender_id_received_at_idx";
ALTER TABLE "sos_messages" DROP CONSTRAINT IF EXISTS "sos_messages_sender_id_fkey";
ALTER TABLE "sos_messages"
  DROP COLUMN IF EXISTS "sender_id",
  DROP COLUMN IF EXISTS "inner_version",
  DROP COLUMN IF EXISTS "sender_seq";
DROP TABLE IF EXISTS "sos_sender_profiles";
DROP TABLE IF EXISTS "sos_senders";

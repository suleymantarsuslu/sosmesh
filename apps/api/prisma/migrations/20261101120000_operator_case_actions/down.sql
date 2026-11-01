ALTER TABLE "sos_messages" DROP COLUMN IF EXISTS "operator_display_text";
ALTER TABLE "incidents" DROP COLUMN IF EXISTS "version";
ALTER TABLE "incidents" DROP COLUMN IF EXISTS "review_status";
DROP TYPE IF EXISTS "OperatorReviewStatus";

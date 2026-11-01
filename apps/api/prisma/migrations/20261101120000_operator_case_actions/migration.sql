-- ADIM 23: optimistic locking + operator review workflow + display text
CREATE TYPE "OperatorReviewStatus" AS ENUM ('NEW', 'SEEN', 'UNDER_REVIEW', 'COORDINATING');

ALTER TABLE "incidents" ADD COLUMN "review_status" "OperatorReviewStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "incidents" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "sos_messages" ADD COLUMN "operator_display_text" TEXT;

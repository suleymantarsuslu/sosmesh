-- ADIM 18: stable SERVER_ACCEPTED receipt timestamp + human review queue flag
ALTER TABLE "sos_messages" ADD COLUMN "server_receipt_at" TIMESTAMP(3);
ALTER TABLE "sos_messages" ADD COLUMN "needs_human_review" BOOLEAN NOT NULL DEFAULT false;

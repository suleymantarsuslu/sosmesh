-- Operator panel feed (ADIM 19): monotonic seq for SSE / polling replay.
CREATE TABLE "operator_feed_events" (
    "seq" BIGSERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "incident_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "location_status" "LocationStatus" NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_feed_events_pkey" PRIMARY KEY ("seq")
);

CREATE INDEX "operator_feed_events_seq_idx" ON "operator_feed_events"("seq");

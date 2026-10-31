-- One operator feed event per SOS message_id (first accept only).
CREATE UNIQUE INDEX "operator_feed_events_message_id_key" ON "operator_feed_events"("message_id");

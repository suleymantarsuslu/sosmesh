-- ADIM 23 audit: one OPERATOR_SEEN operator_view event per SOS message (race-safe idempotency)
CREATE UNIQUE INDEX "message_events_operator_seen_view_unique"
  ON "message_events" ("message_id")
  WHERE "delivery_state" = 'OPERATOR_SEEN' AND "source" = 'operator_view';

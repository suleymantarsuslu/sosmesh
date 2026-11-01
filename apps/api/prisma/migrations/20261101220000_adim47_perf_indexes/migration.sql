-- ADIM 47: operator case list and feed polling hot paths

CREATE INDEX "sos_messages_priority_received_at_idx"
  ON "sos_messages" ("priority" ASC, "received_at" DESC);

CREATE INDEX "sos_messages_received_at_idx"
  ON "sos_messages" ("received_at" DESC);

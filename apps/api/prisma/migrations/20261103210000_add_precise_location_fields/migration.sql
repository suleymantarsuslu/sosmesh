-- Add precise location fields extracted from decrypted inner payload
-- Envelope lat/lng (existing) are coarse ~1km for relay visibility
-- Precise fields are populated by SosPlaintextSource after decryption

ALTER TABLE sos_messages
  ADD COLUMN precise_latitude DECIMAL(10, 7),
  ADD COLUMN precise_longitude DECIMAL(10, 7),
  ADD COLUMN precise_accuracy_meters DOUBLE PRECISION,
  ADD COLUMN precise_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN sos_messages.latitude IS 'Coarse location from envelope (~1km precision, visible to relays)';
COMMENT ON COLUMN sos_messages.longitude IS 'Coarse location from envelope (~1km precision, visible to relays)';
COMMENT ON COLUMN sos_messages.precise_latitude IS 'Precise location from decrypted inner payload (operators only)';
COMMENT ON COLUMN sos_messages.precise_longitude IS 'Precise location from decrypted inner payload (operators only)';
COMMENT ON COLUMN sos_messages.precise_accuracy_meters IS 'Precise accuracy from decrypted inner payload';
COMMENT ON COLUMN sos_messages.precise_captured_at IS 'GPS capture timestamp from decrypted inner payload';

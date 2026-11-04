-- Add optional kind field to broadcast notifications ('standard' default | 'relay_request')

ALTER TABLE broadcast_notifications
  ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'standard'
  CONSTRAINT broadcast_notifications_kind_check CHECK (kind IN ('standard', 'relay_request'));

COMMENT ON COLUMN broadcast_notifications.kind IS 'Broadcast type: standard notification or relay request with action buttons';

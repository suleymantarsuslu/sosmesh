-- Operator broadcast notifications: server-signed push notifications to all devices
-- Can be region-targeted (optional). Relayed via mesh-v2 to offline devices.

CREATE TABLE broadcast_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  created_by_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  region_latitude DECIMAL(10, 7),
  region_longitude DECIMAL(10, 7),
  region_radius_km DOUBLE PRECISION,
  signature TEXT NOT NULL,
  delivered_count INT DEFAULT 0,
  mesh_relay_count INT DEFAULT 0
);

CREATE INDEX broadcast_notifications_expires_at_idx ON broadcast_notifications(expires_at);
CREATE INDEX broadcast_notifications_created_at_idx ON broadcast_notifications(created_at DESC);

COMMENT ON TABLE broadcast_notifications IS 'Operator-sent broadcast notifications, server-signed for mesh relay';
COMMENT ON COLUMN broadcast_notifications.signature IS 'Ed25519 signature over id|title|body|severity|createdAt|expiresAt|region fields';
COMMENT ON COLUMN broadcast_notifications.region_latitude IS 'Optional: center of region target';
COMMENT ON COLUMN broadcast_notifications.region_longitude IS 'Optional: center of region target';
COMMENT ON COLUMN broadcast_notifications.region_radius_km IS 'Optional: radius in km for region target';

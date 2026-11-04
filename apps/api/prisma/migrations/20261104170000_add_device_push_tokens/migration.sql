-- Device push token registration for broadcast push notifications

CREATE TYPE "DevicePlatform" AS ENUM ('android', 'ios');

CREATE TABLE device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform "DevicePlatform" NOT NULL,
  token VARCHAR(500) NOT NULL,
  device_id VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT device_push_tokens_platform_device_id_unique UNIQUE (platform, device_id)
);

CREATE INDEX device_push_tokens_platform_token_idx ON device_push_tokens(platform, token);

COMMENT ON TABLE device_push_tokens IS 'Device push tokens for broadcast push notifications';
COMMENT ON COLUMN device_push_tokens.token IS 'FCM token (Android) or APNs device token (iOS)';
COMMENT ON COLUMN device_push_tokens.device_id IS 'Device identifier (stable across app reinstalls)';

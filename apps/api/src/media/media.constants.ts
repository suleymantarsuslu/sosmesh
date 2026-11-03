/**
 * Media Constants - Transport-dependent limits
 * Work Package B - Voice Rescue
 */

// Online transport (direct HTTP upload): generous limits
export const MEDIA_ONLINE_MAX_AUDIO_SEC = Number(
  process.env.MEDIA_ONLINE_MAX_AUDIO_SEC ?? 600
);
export const MEDIA_ONLINE_MAX_AUDIO_BYTES = Number(
  process.env.MEDIA_ONLINE_MAX_AUDIO_BYTES ?? 52_428_800
);
export const MEDIA_ONLINE_MAX_IMAGE_BYTES = Number(
  process.env.MEDIA_ONLINE_MAX_IMAGE_BYTES ?? 15_728_640
);

// Mesh/BLE transport: tight limits (16 KB from mesh-payload-limits.ts)
export const MAX_MESH_OPAQUE_CIPHERTEXT_BYTES = 16_384;
export const MEDIA_MESH_MAX_AUDIO_SEC = 120;
export const MEDIA_MESH_MAX_AUDIO_BYTES = MAX_MESH_OPAQUE_CIPHERTEXT_BYTES;

// ASR chunking for long audio
export const ASR_CHUNK_MAX_SECONDS = 120;
export const ASR_TIMEOUT_PER_CHUNK_MS = 60_000;

export type MediaSource = 'online' | 'mesh';

export function getMediaLimits(source: MediaSource) {
  if (source === 'mesh') {
    return {
      maxAudioSeconds: MEDIA_MESH_MAX_AUDIO_SEC,
      maxAudioBytes: MEDIA_MESH_MAX_AUDIO_BYTES,
      maxImageBytes: MAX_MESH_OPAQUE_CIPHERTEXT_BYTES,
    };
  }

  return {
    maxAudioSeconds: MEDIA_ONLINE_MAX_AUDIO_SEC,
    maxAudioBytes: MEDIA_ONLINE_MAX_AUDIO_BYTES,
    maxImageBytes: MEDIA_ONLINE_MAX_IMAGE_BYTES,
  };
}

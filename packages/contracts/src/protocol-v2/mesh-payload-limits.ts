/** Max decoded opaque ciphertext bytes per mesh-relay-envelope-v2 (aligns with BLE chunking + ingest headroom). */
export const MAX_MESH_OPAQUE_CIPHERTEXT_BYTES = 16_384;

/** Max base64 character length for opaqueCiphertextBase64 (ceil(bytes/3)*4). */
export const MAX_MESH_OPAQUE_CIPHERTEXT_BASE64_LENGTH =
  Math.ceil(MAX_MESH_OPAQUE_CIPHERTEXT_BYTES / 3) * 4;

export function opaqueCiphertextBase64WithinLimit(base64: string): boolean {
  if (base64.length < 4) {
    return false;
  }
  if (base64.length > MAX_MESH_OPAQUE_CIPHERTEXT_BASE64_LENGTH) {
    return false;
  }
  let decodedBytes: number;
  try {
    decodedBytes = Buffer.from(base64, 'base64').length;
  } catch {
    return false;
  }
  return decodedBytes <= MAX_MESH_OPAQUE_CIPHERTEXT_BYTES;
}

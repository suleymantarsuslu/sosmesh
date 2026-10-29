import { createHash } from 'crypto';

import CRC32 from 'crc-32';

export interface ChunkHeader {
  seq: number;
  total: number;
  crc32: number;
  flags: number;
}

export interface Chunk {
  header: ChunkHeader;
  payload: Buffer;
}

import { ChunkFlags, CHUNK_HEADER_SIZE } from './types';

export function calculateCRC32(data: Buffer): number {
  return CRC32.buf(data) >>> 0; // Convert to unsigned
}

export function calculateDigest(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

export function splitIntoChunks(data: Buffer, chunkSize: number): Chunk[] {
  const totalChunks = Math.ceil(data.length / chunkSize);
  const chunks: Chunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const payload = data.slice(start, end);
    
    let flags = 0;
    if (i === 0) flags |= ChunkFlags.FIRST_CHUNK;
    if (i === totalChunks - 1) flags |= ChunkFlags.LAST_CHUNK;

    const header: ChunkHeader = {
      seq: i,
      total: totalChunks,
      crc32: calculateCRC32(payload),
      flags,
    };

    chunks.push({ header, payload });
  }

  return chunks;
}

export function serializeChunk(chunk: Chunk): Buffer {
  const buffer = Buffer.alloc(CHUNK_HEADER_SIZE + chunk.payload.length);
  
  buffer.writeUInt16BE(chunk.header.seq, 0);
  buffer.writeUInt16BE(chunk.header.total, 2);
  buffer.writeUInt32BE(chunk.header.crc32, 4);
  buffer.writeUInt8(chunk.header.flags, 8);
  // bytes 9-11: reserved (0x00)
  
  chunk.payload.copy(buffer, CHUNK_HEADER_SIZE);
  
  return buffer;
}

export function deserializeChunk(buffer: Buffer): Chunk {
  if (buffer.length < CHUNK_HEADER_SIZE) {
    throw new Error('Buffer too small for chunk header');
  }

  const header: ChunkHeader = {
    seq: buffer.readUInt16BE(0),
    total: buffer.readUInt16BE(2),
    crc32: buffer.readUInt32BE(4),
    flags: buffer.readUInt8(8),
  };

  const payload = buffer.slice(CHUNK_HEADER_SIZE);

  // Verify CRC
  const actualCRC = calculateCRC32(payload);
  if (actualCRC !== header.crc32) {
    throw new Error(`CRC mismatch: expected ${header.crc32}, got ${actualCRC}`);
  }

  return { header, payload };
}

export function assembleChunks(chunks: Chunk[]): Buffer {
  // Sort by sequence
  const sorted = [...chunks].sort((a, b) => a.header.seq - b.header.seq);
  
  // Validate sequence continuity
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].header.seq !== i) {
      throw new Error(`Missing chunk ${i}`);
    }
  }

  // Concatenate payloads
  const buffers = sorted.map(c => c.payload);
  return Buffer.concat(buffers);
}

export function createLastChunkWithDigest(data: Buffer, chunkSize: number, seq: number, total: number): Chunk {
  const digest = calculateDigest(data);
  const payload = Buffer.concat([digest, data.slice(seq * chunkSize)]);
  
  const header: ChunkHeader = {
    seq,
    total,
    crc32: calculateCRC32(payload),
    flags: ChunkFlags.LAST_CHUNK,
  };

  return { header, payload };
}

export function extractDigestFromLastChunk(chunk: Chunk): { digest: Buffer; data: Buffer } {
  if (!(chunk.header.flags & ChunkFlags.LAST_CHUNK)) {
    throw new Error('Not a last chunk');
  }

  if (chunk.payload.length < 32) {
    throw new Error('Last chunk too small for digest');
  }

  const digest = chunk.payload.slice(0, 32);
  const data = chunk.payload.slice(32);

  return { digest, data };
}

export function verifyDigest(assembledData: Buffer, expectedDigest: Buffer): boolean {
  const actualDigest = calculateDigest(assembledData);
  return actualDigest.equals(expectedDigest);
}

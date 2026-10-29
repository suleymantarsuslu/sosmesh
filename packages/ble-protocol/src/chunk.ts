import { createHash } from 'crypto';

import * as CRC32 from 'crc-32';

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
    const crc = calculateCRC32(payload);

    let flags = 0;
    if (i === 0) flags |= ChunkFlags.FIRST_CHUNK;
    if (i === totalChunks - 1) flags |= ChunkFlags.LAST_CHUNK;

    chunks.push({
      header: {
        seq: i,
        total: totalChunks,
        crc32: crc,
        flags
      },
      payload
    });
  }

  return chunks;
}

export function serializeChunk(chunk: Chunk): Buffer {
  const header = Buffer.alloc(CHUNK_HEADER_SIZE);
  header.writeUInt16BE(chunk.header.seq, 0);
  header.writeUInt16BE(chunk.header.total, 2);
  header.writeUInt32BE(chunk.header.crc32, 4);
  header.writeUInt8(chunk.header.flags, 8);
  header.writeUInt16BE(chunk.payload.length, 9);
  header.writeUInt8(0, 11); // reserved
  return Buffer.concat([header, chunk.payload]);
}

export function deserializeChunk(data: Buffer): Chunk | null {
  if (data.length < CHUNK_HEADER_SIZE) {
    return null;
  }

  const seq = data.readUInt16BE(0);
  const total = data.readUInt16BE(2);
  const crc32 = data.readUInt32BE(4);
  const flags = data.readUInt8(8);
  const payloadLen = data.readUInt16BE(9);

  if (data.length < CHUNK_HEADER_SIZE + payloadLen) {
    return null;
  }

  const payload = data.slice(CHUNK_HEADER_SIZE, CHUNK_HEADER_SIZE + payloadLen);

  return {
    header: { seq, total, crc32, flags },
    payload
  };
}

export function assembleChunks(chunks: Chunk[]): Buffer {
  const sorted = chunks.sort((a, b) => a.header.seq - b.header.seq);
  return Buffer.concat(sorted.map(c => c.payload));
}

export function extractDigestFromLastChunk(lastChunk: Chunk): { digest: Buffer; data: Buffer } | null {
  if (!(lastChunk.header.flags & ChunkFlags.LAST_CHUNK)) {
    return null;
  }
  if (lastChunk.payload.length < 32) {
    return null;
  }
  const digest = lastChunk.payload.slice(-32);
  const data = lastChunk.payload.slice(0, -32);
  return { digest, data };
}

export function verifyDigest(assembled: Buffer, digest: Buffer): boolean {
  const computed = calculateDigest(assembled);
  return computed.equals(digest);
}

export function createLastChunkWithDigest(
  fullPayload: Buffer,
  chunkSize: number,
  seq: number,
  total: number
): Chunk {
  const digest = calculateDigest(fullPayload);
  
  const dataStart = seq * chunkSize;
  const dataEnd = Math.min(dataStart + chunkSize - 32, fullPayload.length);
  const chunkData = fullPayload.slice(dataStart, dataEnd);
  
  const payload = Buffer.concat([chunkData, digest]);
  const crc = calculateCRC32(payload);

  return {
    header: {
      seq,
      total,
      crc32: crc,
      flags: ChunkFlags.LAST_CHUNK
    },
    payload
  };
}

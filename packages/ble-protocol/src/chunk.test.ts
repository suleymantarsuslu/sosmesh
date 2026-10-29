import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

import {
  calculateCRC32,
  calculateDigest,
  splitIntoChunks,
  serializeChunk,
  deserializeChunk,
  assembleChunks,
  verifyDigest
} from './chunk';
import { ChunkFlags } from './types';

const testVectors: {
  vectors: Array<{
    name: string;
    input_hex?: string;
    expected_crc32?: number;
    expected_sha256?: string;
    message?: string;
    chunk_size?: number;
    expected_chunks?: number;
    expected_seqs?: number[];
  }>;
} = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../fixtures/ble/test-vectors.json'), 'utf-8')
);

describe('BLE Protocol Chunking', () => {
  it('should calculate CRC32 correctly', () => {
    const vector = testVectors.vectors.find((v) => v.name === 'CRC32 Known Input');
    if (!vector) throw new Error('Test vector not found');
    const input = Buffer.from(vector.input_hex!, 'hex');
    const crc = calculateCRC32(input);
    expect(crc).toBe(vector.expected_crc32);
  });

  it('should calculate SHA-256 correctly', () => {
    const vector = testVectors.vectors.find((v) => v.name === 'SHA-256 Known Input');
    if (!vector) throw new Error('Test vector not found');
    const input = Buffer.from(vector.input_hex!, 'hex');
    const digest = calculateDigest(input);
    expect(digest.toString('hex')).toBe(vector.expected_sha256);
  });

  it('should split message into chunks', () => {
    const vector = testVectors.vectors.find((v) => v.name === 'Simple Chunking');
    if (!vector) throw new Error('Test vector not found');
    const message = Buffer.from(vector.message!);
    const chunks = splitIntoChunks(message, vector.chunk_size!);
    
    expect(chunks.length).toBe(vector.expected_chunks);
    expect(chunks.map(c => c.header.seq)).toEqual(vector.expected_seqs);
    expect(chunks[0].header.flags & ChunkFlags.FIRST_CHUNK).toBeTruthy();
    expect(chunks[chunks.length - 1].header.flags & ChunkFlags.LAST_CHUNK).toBeTruthy();
  });

  it('should serialize and deserialize chunk', () => {
    const message = Buffer.from('TEST_MESSAGE_NO_PII');
    const chunks = splitIntoChunks(message, 10);
    const chunk = chunks[0];
    
    const serialized = serializeChunk(chunk);
    const deserialized = deserializeChunk(serialized);
    
    expect(deserialized.header).toEqual(chunk.header);
    expect(deserialized.payload.equals(chunk.payload)).toBe(true);
  });

  it('should assemble chunks correctly', () => {
    const message = Buffer.from('SYNTHETIC_TEST_MESSAGE_FOR_ASSEMBLY');
    const chunks = splitIntoChunks(message, 15);
    const assembled = assembleChunks(chunks);
    
    expect(assembled.equals(message)).toBe(true);
  });

  it('should verify digest', () => {
    const message = Buffer.from('TEST_DIGEST_VERIFICATION');
    const digest = calculateDigest(message);
    
    expect(verifyDigest(message, digest)).toBe(true);
    
    const wrongDigest = Buffer.alloc(32, 0xff);
    expect(verifyDigest(message, wrongDigest)).toBe(false);
  });

  it('should reject chunk with bad CRC', () => {
    const message = Buffer.from('TEST');
    const chunks = splitIntoChunks(message, 10);
    const serialized = serializeChunk(chunks[0]);
    
    // Corrupt CRC
    serialized.writeUInt32BE(0x12345678, 4);
    
    expect(() => deserializeChunk(serialized)).toThrow('CRC mismatch');
  });
});

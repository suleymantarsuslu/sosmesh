export const PROTOCOL_VERSION = 0x01;

export const SERVICE_UUID = '0000FFF0-0000-1000-8000-00805F9B34FB';
export const CONTROL_CHAR_UUID = '0000FFF1-0000-1000-8000-00805F9B34FB';
export const DATA_CHAR_UUID = '0000FFF2-0000-1000-8000-00805F9B34FB';
export const ACK_CHAR_UUID = '0000FFF3-0000-1000-8000-00805F9B34FB';

export const CHUNK_HEADER_SIZE = 12;
export const ATT_OVERHEAD = 3;
export const DEFAULT_MTU = 247;

export enum MessageType {
  HELLO = 0x01,
  HELLO_ACK = 0x02,
  ACK = 0x10,
  NACK = 0x11,
  RESUME_REQUEST = 0x20,
}

export enum ChunkFlags {
  FIRST_CHUNK = 0x01,
  LAST_CHUNK = 0x02,
}

export enum ErrorCode {
  CRC_MISMATCH = 0x01,
  SEQUENCE_ERROR = 0x02,
  TIMEOUT = 0x03,
  BUFFER_FULL = 0x04,
  VERSION_MISMATCH = 0x10,
  DIGEST_INVALID = 0x11,
  TOTAL_MISMATCH = 0x12,
  GENERIC_TIMEOUT = 0x20,
}

export enum TransferState {
  IDLE = 'IDLE',
  HELLO_SENT = 'HELLO_SENT',
  READY = 'READY',
  SENDING = 'SENDING',
  WAIT_ACK = 'WAIT_ACK',
  RETRY_CHUNK = 'RETRY_CHUNK',
  VERIFYING = 'VERIFYING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RESUMING = 'RESUMING',
}

export enum AckLevel {
  DEVICE_STORED = 'DEVICE_STORED',
  PEER_RECEIVED = 'PEER_RECEIVED',
  RELAY_FORWARDED = 'RELAY_FORWARDED',
  SERVER_RECEIVED = 'SERVER_RECEIVED',
  OPERATOR_VIEWED = 'OPERATOR_VIEWED',
  INCIDENT_OPENED = 'INCIDENT_OPENED',
}

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

export interface HelloMessage {
  type: MessageType.HELLO;
  version: number;
  nonce: Buffer;
  mtu: number;
}

export interface HelloAckMessage {
  type: MessageType.HELLO_ACK;
  version: number;
  nonceEcho: Buffer;
  mtu: number;
  status: number;
}

export interface AckMessage {
  type: MessageType.ACK;
  seq: number;
  status: number;
}

export interface NackMessage {
  type: MessageType.NACK;
  seq: number;
  reason: ErrorCode;
}

export interface TransferEvent {
  timestamp: number;
  event: string;
  msgId: string;
  seq?: number;
  total?: number;
  error?: string;
}

export interface TransferConfig {
  mtu: number;
  windowSize: number;
  chunkTimeout: number;
  maxRetries: number;
  retryJitter: number;
}

export const DEFAULT_CONFIG: TransferConfig = {
  mtu: DEFAULT_MTU,
  windowSize: 4,
  chunkTimeout: 2000,
  maxRetries: 3,
  retryJitter: 500,
};

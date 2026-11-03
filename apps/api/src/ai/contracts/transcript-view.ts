/**
 * Transcript View Contract - Operator API response shape
 * Work Package A - AI Foundation
 */

export type TranscriptTurn = {
  turnId: number;
  startMs: number;
  endMs: number;
  transcript: string;
  speaker?: string;
};

export type TranscriptView = {
  attachmentId: string;
  model: string;
  transcript: string;
  turns: TranscriptTurn[];
  language: string | null;
  audioDurationMs: number | null;
  createdAt: string;
};

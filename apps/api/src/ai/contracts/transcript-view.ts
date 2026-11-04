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
  /** Machine translation into the operator UI language; null when not needed or unavailable. */
  translatedTranscript: string | null;
  /** Alias of translatedTranscript, kept for clients that read the message-style field name. */
  translatedText: string | null;
  /** Locale the translation is in (equals the requested UI locale when present). */
  translationLanguage: string | null;
};

import { HttpException, HttpStatus } from '@nestjs/common';

/** Spec §8.2: up to 30/h per sender are accepted and merged with full AI processing. */
export const SENDER_FULL_PROCESSING_PER_HOUR = 30;
/** Spec §8.2: above 60/h per sender the server answers 429 + Retry-After. */
export const SENDER_HARD_LIMIT_PER_HOUR = 60;
/** Burst allowance for priority or content-rich messages (note, location). */
export const SENDER_BURST_ALLOWANCE = 5;
export const SENDER_WINDOW_MS = 3_600_000;

export type SenderRateDecision =
  | { action: 'accept'; fullProcessing: boolean }
  | { action: 'reject'; retryAfterSeconds: number };

/**
 * @param acceptedInWindow messages already accepted for this sender in the last hour (excluding this one)
 * @param oldestInWindowAt receivedAt of the oldest of those messages
 * @param hasRealContent whether the message has note, location, or high priority
 */
export function decideSenderRate(
  acceptedInWindow: number,
  oldestInWindowAt: Date | null,
  now: Date = new Date(),
  hasRealContent = false
): SenderRateDecision {
  const effectiveLimit = hasRealContent 
    ? SENDER_HARD_LIMIT_PER_HOUR + SENDER_BURST_ALLOWANCE 
    : SENDER_HARD_LIMIT_PER_HOUR;
    
  if (acceptedInWindow >= effectiveLimit) {
    const freeAt = (oldestInWindowAt?.getTime() ?? now.getTime()) + SENDER_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((freeAt - now.getTime()) / 1000));
    return { action: 'reject', retryAfterSeconds };
  }
  return { action: 'accept', fullProcessing: acceptedInWindow < SENDER_FULL_PROCESSING_PER_HOUR };
}

export class SenderRateLimitedException extends HttpException {
  constructor(readonly retryAfterSeconds: number) {
    super(
      { code: 'SENDER_RATE_LIMITED', message: 'Too many SOS messages from this sender; retry later', retryAfterSeconds },
      HttpStatus.TOO_MANY_REQUESTS
    );
  }
}

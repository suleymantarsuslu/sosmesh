/**
 * MetaModelClient - unified Meta AI API client
 * Work Package A - AI Foundation
 * 
 * Supports: Spark 1.3, Voice Transcribe 1.0, SAM 3.1
 * Features: json_schema, image input, multipart ASR, SAM responses, retry, 429 handling, circuit breaker, concurrency limit
 */

import { Injectable, Logger } from '@nestjs/common';
import { FormData, File } from 'undici';

type FetchLike = typeof fetch;

export type SparkJsonRequest = {
  schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
  prompt: string;
  systemPrompt?: string;
  images?: Array<{ url: string } | { dataUrl: string }>;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
};

export type SparkJsonResponse = {
  ok: true;
  json: Record<string, unknown>;
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  };
  model: string;
  requestId: string;
} | {
  ok: false;
  error: string;
  retryable: boolean;
};

export type TranscribeRequest = {
  wavBuffer: Buffer;
  languageBias?: string[];
  mode?: 'PUSH_TO_TALK' | 'ENDPOINTING' | 'DIARIZATION';
};

export type TranscribeResponse = {
  ok: true;
  sessionId: string;
  transcript: string;
  audioDurationMs: number;
  turns: Array<{
    turnId: number;
    startMs: number;
    endMs: number;
    transcript: string;
    speaker?: string;
  }>;
} | {
  ok: false;
  error: string;
  retryable: boolean;
};

export type SamSegmentRequest = {
  imageBuffer: Buffer;
  mimeType: string;
  concept: string;
};

export type SamBoundingBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
};

export type SamMask = {
  x: number;
  y: number;
  width: number;
  height: number;
  encoding: string;
  data: string;
};

export type SamSegment = {
  id: string;
  confidence: number | null;
  boundingBox: SamBoundingBox;
  mask: SamMask | null;
};

export type SamResponse = {
  ok: true;
  segments: SamSegment[];
  imagesProcessed: number;
} | {
  ok: false;
  error: string;
  retryable: boolean;
};

type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private failures = 0;
  private openUntilMs = 0;

  constructor(
    private readonly threshold: number,
    private readonly cooldownMs: number
  ) {}

  getState(): CircuitState {
    const now = Date.now();
    if (now < this.openUntilMs) {
      return 'open';
    }
    if (this.failures > 0) {
      return 'half-open';
    }
    return 'closed';
  }

  assertClosed(): void {
    if (this.getState() === 'open') {
      throw new Error('Circuit breaker is open');
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openUntilMs = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openUntilMs = Date.now() + this.cooldownMs;
    }
  }
}

class RateLimiter {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly maxTokens: number,
    private readonly refillPerMinute: number
  ) {
    this.tokens = maxTokens;
    this.lastRefillMs = Date.now();
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefillMs;
    const refill = (elapsed / 60000) * this.refillPerMinute;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + refill);
    this.lastRefillMs = now;

    if (this.tokens < 1) {
      const waitMs = ((1 - this.tokens) / this.refillPerMinute) * 60000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.tokens = 1;
    }

    this.tokens -= 1;
  }
}

@Injectable()
export class MetaModelClient {
  private readonly logger = new Logger(MetaModelClient.name);
  private readonly baseUrl: string;
  private readonly sparkModel: string;
  private readonly asrModel: string;
  private readonly samModel: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly maxTokens: number;
  private readonly circuit: CircuitBreaker;
  private readonly samRateLimiter: RateLimiter;
  private readonly fetchImpl: FetchLike;

  constructor() {
    this.baseUrl = process.env.META_BASE_URL ?? 'https://api.meta.ai/v1';
    this.sparkModel = process.env.META_MODEL ?? 'muse-spark-1.3';
    this.asrModel = process.env.META_ASR_MODEL ?? 'muse-voice-transcribe-1.0';
    this.samModel = process.env.META_SAM_MODEL ?? 'sam-3.1';
    this.apiKey = process.env.MODEL_API_KEY ?? '';
    this.timeoutMs = Number(process.env.META_TIMEOUT_MS ?? 15000);
    this.maxRetries = Number(process.env.META_MAX_RETRIES ?? 2);
    this.maxTokens = Number(process.env.META_MAX_TOKENS ?? 4096);
    this.circuit = new CircuitBreaker(
      Number(process.env.META_CIRCUIT_FAILURE_THRESHOLD ?? 3),
      Number(process.env.META_CIRCUIT_COOLDOWN_MS ?? 30000)
    );
    this.samRateLimiter = new RateLimiter(2, 60);
    this.fetchImpl = fetch;

    // Refuse contributor models
    if (this.sparkModel.endsWith('-contributor') || 
        this.asrModel.endsWith('-contributor') || 
        this.samModel.endsWith('-contributor')) {
      throw new Error('Contributor models are not allowed (Standard mode only)');
    }

    if (process.env.NODE_ENV === 'production' && this.apiKey.includes('dev-test')) {
      throw new Error('Production must never accept dev-test keys');
    }
  }

  getCircuitState(): CircuitState {
    return this.circuit.getState();
  }

  async chatJson(request: SparkJsonRequest): Promise<SparkJsonResponse> {
    try {
      this.circuit.assertClosed();
    } catch {
      return { ok: false, error: 'circuit_open', retryable: true };
    }

    const messages: Array<{ role: string; content: unknown }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: 'text', text: request.prompt },
    ];

    if (request.images) {
      for (const img of request.images) {
        if ('url' in img) {
          userContent.push({ type: 'image_url', image_url: { url: img.url } });
        } else {
          userContent.push({ type: 'image_url', image_url: { url: img.dataUrl } });
        }
      }
    }

    messages.push({ role: 'user', content: userContent });

    const body = {
      model: this.sparkModel,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: request.schema,
      },
      max_tokens: this.maxTokens,
      ...(request.reasoningEffort ? { reasoning_effort: request.reasoningEffort } : {}),
    };

    return this.retryRequest(async () => {
      const response = await this.callWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        this.logger.warn({ msg: '429 rate limit', retryAfterSeconds: waitSeconds });
        await this.sleep(waitSeconds * 1000);
        return { ok: false, error: 'rate_limited', retryable: true };
      }

      if (response.status >= 500) {
        return { ok: false, error: `http_${response.status}`, retryable: true };
      }

      if (!response.ok) {
        return { ok: false, error: `http_${response.status}`, retryable: false };
      }

      const data = await response.json() as {
        id?: string;
        choices?: Array<{
          message?: { content?: string | null };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          completion_tokens_details?: { reasoning_tokens?: number };
        };
        model?: string;
      };

      const choice = data.choices?.[0];
      if (choice?.finish_reason === 'length') {
        return { ok: false, error: 'response_truncated', retryable: false };
      }

      const content = choice?.message?.content;
      if (!content) {
        return { ok: false, error: 'empty_content', retryable: false };
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content) as Record<string, unknown>;
      } catch {
        return { ok: false, error: 'invalid_json', retryable: false };
      }

      const usage = data.usage ?? {};
      const inputTokens = usage.prompt_tokens ?? 0;
      const outputTokens = usage.completion_tokens ?? 0;
      const reasoningTokens = usage.completion_tokens_details?.reasoning_tokens ?? 0;

      return {
        ok: true,
        json: parsed,
        usage: {
          inputTokens,
          outputTokens,
          reasoningTokens,
          totalTokens: usage.total_tokens ?? (inputTokens + outputTokens),
        },
        model: data.model ?? this.sparkModel,
        requestId: data.id ?? 'unknown',
      };
    });
  }

  async transcribe(request: TranscribeRequest): Promise<TranscribeResponse> {
    try {
      this.circuit.assertClosed();
    } catch {
      return { ok: false, error: 'circuit_open', retryable: true };
    }

    const requestJson = {
      model: this.asrModel,
      audioEncoding: 'WAV',
      mode: request.mode ?? 'PUSH_TO_TALK',
      ...(request.languageBias ? { languageBias: request.languageBias } : {}),
    };

    const formData = new FormData();
    formData.set('request', new File([JSON.stringify(requestJson)], 'request.json', {
      type: 'application/json',
    }));
    formData.set('audio', new File([request.wavBuffer], 'audio.wav', {
      type: 'audio/wav',
    }));

    return this.retryRequest(async () => {
      const response = await this.callWithTimeout(`${this.baseUrl}/asr/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData as unknown as BodyInit,
      });

      if (response.status === 429 || response.status >= 500) {
        return { ok: false, error: `http_${response.status}`, retryable: true };
      }

      if (!response.ok) {
        return { ok: false, error: `http_${response.status}`, retryable: false };
      }

      const data = await response.json() as {
        sessionId?: string;
        transcript?: string;
        audioDurationMs?: number;
        turns?: Array<{
          turnId?: number;
          startMs?: number;
          endMs?: number;
          transcript?: string;
          speaker?: string;
        }>;
      };

      return {
        ok: true,
        sessionId: data.sessionId ?? 'unknown',
        transcript: data.transcript ?? '',
        audioDurationMs: data.audioDurationMs ?? 0,
        turns: (data.turns ?? []).map((t) => ({
          turnId: t.turnId ?? 0,
          startMs: t.startMs ?? 0,
          endMs: t.endMs ?? 0,
          transcript: t.transcript ?? '',
          speaker: t.speaker,
        })),
      };
    }, 1);
  }

  async samSegment(request: SamSegmentRequest): Promise<SamResponse> {
    try {
      this.circuit.assertClosed();
    } catch {
      return { ok: false, error: 'circuit_open', retryable: true };
    }

    await this.samRateLimiter.acquire();

    const dataUrl = `data:${request.mimeType};base64,${request.imageBuffer.toString('base64')}`;

    const body = {
      model: this.samModel,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: request.concept },
            { type: 'input_image', image_url: dataUrl },
          ],
        },
      ],
      stream: false,
      metadata: {
        mask_encoding: 'one_bit',
        include_confidence: 'true',
      },
    };

    return this.retryRequest(async () => {
      const response = await this.callWithTimeout(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 60;
        await this.sleep(waitSeconds * 1000);
        return { ok: false, error: 'rate_limited', retryable: true };
      }

      if (response.status >= 500) {
        return { ok: false, error: `http_${response.status}`, retryable: true };
      }

      if (!response.ok) {
        return { ok: false, error: `http_${response.status}`, retryable: false };
      }

      const data = await response.json() as {
        output?: Array<{
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
        usage?: {
          images_processed?: number;
        };
      };

      const outputText = data.output?.[0]?.content?.find((c) => c.type === 'output_text')?.text ?? '';
      const segments = this.parseSamOutput(outputText);

      return {
        ok: true,
        segments,
        imagesProcessed: data.usage?.images_processed ?? 0,
      };
    });
  }

  computeCost(model: string, inputTokens: number, outputTokens: number): number {
    const prices: Record<string, { input: number; output: number }> = {
      'muse-spark-1.3': { input: 1.25 / 1_000_000, output: 4.25 / 1_000_000 },
      'muse-voice-transcribe-1.0': { input: 0, output: 0 },
      'sam-3.1': { input: 0, output: 0 },
    };

    const price = prices[model] ?? { input: 0, output: 0 };
    return inputTokens * price.input + outputTokens * price.output;
  }

  computeAsrCost(audioDurationMs: number): number {
    const hours = audioDurationMs / 3_600_000;
    return hours * 0.18;
  }

  computeSamCost(imagesProcessed: number): number {
    return imagesProcessed * 0.0025;
  }

  private parseSamOutput(text: string): SamSegment[] {
    const segments: SamSegment[] = [];
    const frameRegex = /<0f>/g;
    const segmentRegex = /ID(\d+)<\|box;x1=([\d.]+);y1=([\d.]+);x2=([\d.]+);y2=([\d.]+);w=([\d.]+);h=([\d.]+)(?:;c=([\d.]+))?\|>(?:<\|mask;x=(\d+);y=(\d+)(?:;c=([\d.]+))?;data=([\d.]+),([\d.]+),([!~][^\|]+)\|>)?/g;

    let match;
    while ((match = segmentRegex.exec(text)) !== null) {
      const [, id, x1, y1, x2, y2, w, h, confidence, maskX, maskY, , maskW, maskH, maskData] = match;

      const box: SamBoundingBox = {
        x1: parseFloat(x1),
        y1: parseFloat(y1),
        x2: parseFloat(x2),
        y2: parseFloat(y2),
        width: parseFloat(w),
        height: parseFloat(h),
      };

      let mask: SamMask | null = null;
      if (maskData) {
        mask = {
          x: parseInt(maskX, 10),
          y: parseInt(maskY, 10),
          width: parseInt(maskW, 10),
          height: parseInt(maskH, 10),
          encoding: maskData[0],
          data: maskData,
        };
      }

      segments.push({
        id: id ?? 'unknown',
        confidence: confidence ? parseFloat(confidence) : null,
        boundingBox: box,
        mask,
      });
    }

    return segments;
  }

  private async retryRequest<T extends { ok: boolean; error?: string; retryable?: boolean }>(
    fn: () => Promise<T>,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.maxRetries;
    let lastResult: T | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) {
        const backoffMs = Math.min(16000, 1000 * 2 ** (attempt - 1));
        await this.sleep(backoffMs);
      }

      try {
        const result = await fn();
        
        if (result.ok) {
          this.circuit.recordSuccess();
          return result;
        }

        lastResult = result;

        if (!result.retryable) {
          this.circuit.recordFailure();
          return result;
        }

        this.circuit.recordFailure();
      } catch (error) {
        this.circuit.recordFailure();
        this.logger.error({
          errorCode: error instanceof Error ? error.constructor.name : 'API_CALL_FAILED',
          errorName: error instanceof Error ? error.name : 'unknown',
          msg: 'Meta API call failed',
        });
      }
    }

    return lastResult ?? { ok: false, error: 'max_retries_exceeded', retryable: false } as T;
  }

  private async callWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('timeout');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

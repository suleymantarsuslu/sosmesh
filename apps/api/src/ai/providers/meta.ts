import {
  DEFAULT_META_BASE_URL,
  DEFAULT_META_MODEL,
  DEFAULT_META_MAX_TOKENS,
} from '../ai.constants';
import { SOS_AI_SYSTEM_PROMPT } from '../system-prompt';
import {
  validateSosAiOutput,
  type SosAiOutput,
} from '../schemas/sos-ai-output.schema';

export type FetchLike = typeof fetch;

export type MetaProviderConfig = {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  maxTokens: number;
  fetchImpl?: FetchLike;
};

export type MetaClassifyInput = {
  plaintext: string;
  languageHint?: string;
};

export type MetaClassifyResult =
  | { ok: true; output: SosAiOutput; modelVersion: string }
  | { ok: false; reason: string; retryable: boolean };

function metaSuccess(output: SosAiOutput, modelVersion: string): MetaClassifyResult {
  return { ok: true, output, modelVersion };
}

function metaFailure(reason: string, retryable: boolean): MetaClassifyResult {
  return { ok: false, reason, retryable };
}

export type MetaProvider = {
  classify(input: MetaClassifyInput): Promise<MetaClassifyResult>;
};

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

type CircuitState = {
  failures: number;
  openUntilMs: number;
};

export class MetaCircuitBreaker {
  private state: CircuitState = { failures: 0, openUntilMs: 0 };

  constructor(
    private readonly failureThreshold: number,
    private readonly cooldownMs: number
  ) {}

  assertClosed(nowMs = Date.now()): void {
    if (nowMs < this.state.openUntilMs) {
      throw new CircuitOpenError('meta circuit open');
    }
  }

  recordSuccess(): void {
    this.state = { failures: 0, openUntilMs: 0 };
  }

  recordFailure(nowMs = Date.now()): void {
    this.state.failures += 1;
    if (this.state.failures >= this.failureThreshold) {
      this.state.openUntilMs = nowMs + this.cooldownMs;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new SyntaxError('no JSON object in model response');
}

export class MetaHttpProvider implements MetaProvider {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly config: MetaProviderConfig,
    private readonly circuit: MetaCircuitBreaker
  ) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async classify(input: MetaClassifyInput): Promise<MetaClassifyResult> {
    try {
      this.circuit.assertClosed();
    } catch {
      return metaFailure('circuit_open', true);
    }

    let lastReason = 'unknown';
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      if (attempt > 0) {
        const backoffMs = Math.min(8000, 250 * 2 ** (attempt - 1));
        await sleep(backoffMs);
      }

      try {
        const result = await this.callOnce(input);
        if (result.ok === false) {
          lastReason = result.reason;
          if (result.retryable === false) {
            this.circuit.recordFailure();
            return result;
          }
          this.circuit.recordFailure();
        } else {
          this.circuit.recordSuccess();
          return result;
        }
      } catch (error) {
        lastReason = error instanceof Error ? error.message : 'meta_call_failed';
        this.circuit.recordFailure();
      }
    }

    return metaFailure(lastReason, true);
  }

  private async callOnce(input: MetaClassifyInput): Promise<MetaClassifyResult> {
    const modelVersion = `${this.config.model}@${this.config.baseUrl}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    const url = `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: SOS_AI_SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                task: 'classify_sos',
                language_hint: input.languageHint ?? null,
                message: input.plaintext,
                response_schema: {
                  categories: 'string[]',
                  persons_estimate: 'number|null',
                  injuries_reported: 'string[]',
                  needs: 'string[]',
                  urgency_suggestion: 'low|medium|high|unknown',
                  uncertainty: 'boolean',
                  quoted_evidence: 'string[]',
                  location_unknown: 'boolean',
                  language: 'string',
                  requires_human_review: true,
                },
              }),
            },
          ],
          temperature: 0,
          max_tokens: this.config.maxTokens,
        }),
        signal: controller.signal,
      });

      if (response.status === 429 || response.status >= 500) {
        return metaFailure(`http_${response.status}`, true);
      }

      if (!response.ok) {
        return metaFailure(`http_${response.status}`, false);
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string | null };
          finish_reason?: string;
        }>;
      };
      const choice = payload.choices?.[0];
      const finishReason = choice?.finish_reason;
      if (finishReason === 'length') {
        return metaFailure('response_truncated', false);
      }

      const content = choice?.message?.content;
      if (content === null || content === undefined || content === '') {
        return metaFailure('empty_model_content', false);
      }

      let parsed: unknown;
      try {
        parsed = extractJsonObject(content);
      } catch {
        return metaFailure('invalid_model_json', false);
      }

      const validated = validateSosAiOutput(parsed);
      if (validated.ok === false) {
        return metaFailure(validated.reason, false);
      }

      return metaSuccess(validated.value, modelVersion);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return metaFailure('timeout', true);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

export type MockMetaFixture = {
  id: string;
  locale: string;
  input: string;
  output: SosAiOutput;
};

export class MockMetaProvider implements MetaProvider {
  constructor(private readonly fixtures: MockMetaFixture[]) {}

  async classify(input: MetaClassifyInput): Promise<MetaClassifyResult> {
    const normalized = input.plaintext.trim().toLowerCase();
    const match =
      this.fixtures.find((fixture) => normalized.includes(fixture.input.trim().toLowerCase())) ??
      this.fixtures.find((fixture) => fixture.id === 'default');

    if (!match) {
      return metaFailure('fixture_not_found', false);
    }

    const validated = validateSosAiOutput(match.output);
    if (validated.ok === false) {
      return metaFailure(validated.reason, false);
    }

    return metaSuccess(validated.value, 'mock-meta-fixture');
  }
}

export function buildMetaProviderFromEnv(
  env: NodeJS.ProcessEnv,
  deps?: { fetchImpl?: FetchLike; circuit?: MetaCircuitBreaker }
): MetaProvider | null {
  if (env.AI_ENABLED === 'false') {
    return null;
  }
  const apiKey = env.MODEL_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const baseUrl = env.META_BASE_URL?.trim() || DEFAULT_META_BASE_URL;
  const model = env.META_MODEL?.trim() || DEFAULT_META_MODEL;
  const timeoutMs = Number(env.META_TIMEOUT_MS ?? 15000);
  const maxRetries = Number(env.META_MAX_RETRIES ?? 2);
  const maxTokens = Number(env.META_MAX_TOKENS ?? DEFAULT_META_MAX_TOKENS);

  const circuit =
    deps?.circuit ??
    new MetaCircuitBreaker(
      Number(env.META_CIRCUIT_FAILURE_THRESHOLD ?? 3),
      Number(env.META_CIRCUIT_COOLDOWN_MS ?? 30000)
    );

  return new MetaHttpProvider(
    {
      baseUrl,
      model,
      apiKey,
      timeoutMs,
      maxRetries,
      maxTokens,
      fetchImpl: deps?.fetchImpl,
    },
    circuit
  );
}

export function buildMockMetaProvider(fixtures: MockMetaFixture[]): MockMetaProvider {
  return new MockMetaProvider(fixtures);
}

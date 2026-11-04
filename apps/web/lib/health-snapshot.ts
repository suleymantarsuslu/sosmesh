import { apiBaseUrl, isE2eMock } from './config';
import { getSessionToken } from './session';

export type ComponentLevel = 'operational' | 'degraded' | 'major_outage';

export type HealthSummary = {
  statusPage: {
    overall: ComponentLevel;
    components: Record<string, ComponentLevel>;
    updatedAt: string;
  };
  metrics: Record<string, number>;
};

export type HealthReady = {
  status: string;
  database: string;
  storage: string;
};

export type HealthAi = {
  enabled: boolean;
  circuitState: string;
  queueDepth: number;
  lastAnalysisAt: string | null;
  budgetUsedToday: number;
  budgetDailyLimit: number;
  modelsAvailable: Record<string, boolean>;
};

export type HealthSnapshot = {
  summary: HealthSummary | null;
  ready: HealthReady | null;
  ai: HealthAi | null;
  /** Live event feed reachability (what the operator SSE/poll feed depends on). */
  feed: { reachable: boolean; latencyMs: number | null } | null;
  apiLatencyMs: number | null;
  fetchedAt: string;
};

const PROBE_TIMEOUT_MS = 5000;

async function probe(
  path: string,
  token: string | undefined
): Promise<{ ok: boolean; status: number; body: unknown; ms: number }> {
  const started = Date.now();
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { ok: res.ok, status: res.status, body, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, body: null, ms: Date.now() - started };
  }
}

function pickStr(value: unknown, fallback = 'unknown'): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Collects a health snapshot for the operator health page. Only coarse status values are
 * returned: no env values, error details or storage paths ever leave this function.
 */
export async function loadHealthSnapshot(): Promise<HealthSnapshot> {
  const fetchedAt = new Date().toISOString();
  if (isE2eMock()) {
    return { summary: null, ready: null, ai: null, feed: null, apiLatencyMs: null, fetchedAt };
  }
  const token = await getSessionToken();
  const [summaryRes, readyRes, aiRes, feedRes] = await Promise.all([
    probe('/v1/operator/observability/summary', token),
    probe('/health/ready', undefined),
    probe('/v1/operator/ai/status', token),
    probe('/v1/operator/events?after=9999999999999', token),
  ]);

  const summary =
    summaryRes.ok && summaryRes.body && typeof summaryRes.body === 'object'
      ? (summaryRes.body as HealthSummary)
      : null;

  // /health/ready answers 503 when the database is down; map that to a coarse "down" instead of dropping it.
  let ready: HealthReady | null = null;
  if (readyRes.ok && readyRes.body && typeof readyRes.body === 'object') {
    const r = readyRes.body as Record<string, unknown>;
    ready = {
      status: pickStr(r.status),
      database: pickStr(r.database),
      storage: pickStr(r.storage),
    };
  } else if (readyRes.status === 503) {
    ready = { status: 'down', database: 'down', storage: 'unknown' };
  }

  let ai: HealthAi | null = null;
  if (aiRes.ok && aiRes.body && typeof aiRes.body === 'object') {
    const a = aiRes.body as Record<string, unknown>;
    const models = (a.modelsAvailable ?? {}) as Record<string, unknown>;
    ai = {
      enabled: a.enabled === true,
      circuitState: pickStr(a.circuitState),
      queueDepth: typeof a.queueDepth === 'number' ? a.queueDepth : 0,
      lastAnalysisAt: typeof a.lastAnalysisAt === 'string' ? a.lastAnalysisAt : null,
      budgetUsedToday: typeof a.budgetUsedToday === 'number' ? a.budgetUsedToday : 0,
      budgetDailyLimit: typeof a.budgetDailyLimit === 'number' ? a.budgetDailyLimit : 0,
      modelsAvailable: Object.fromEntries(
        Object.entries(models).map(([key, value]) => [key, value === true])
      ),
    };
  }

  return {
    summary,
    ready,
    ai,
    feed: { reachable: feedRes.ok, latencyMs: feedRes.ok ? feedRes.ms : null },
    apiLatencyMs: summaryRes.ok ? summaryRes.ms : null,
    fetchedAt,
  };
}

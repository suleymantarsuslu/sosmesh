'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useOperatorPreferences } from '../../components/operator/OperatorPreferencesProvider';
import type { HealthSnapshot } from '../../lib/health-snapshot';
import { Icon, type IconName } from '../cases/detail/icons';
import { OpsChip, OpsHeader, type OpsTone } from '../ops/OpsPrimitives';

export const HEALTH_REFRESH_MS = 30_000;

type Level = 'operational' | 'degraded' | 'major_outage' | 'unknown';

const LEVEL_TONE: Record<Level, OpsTone> = {
  operational: 'ok',
  degraded: 'warn',
  major_outage: 'danger',
  unknown: 'muted',
};

const LEVEL_KEY: Record<Level, string> = {
  operational: 'web.health.levelOperational',
  degraded: 'web.health.levelDegraded',
  major_outage: 'web.health.levelOutage',
  unknown: 'web.health.levelUnknown',
};

const LEVEL_RANK: Record<Level, number> = {
  unknown: 0,
  operational: 1,
  degraded: 2,
  major_outage: 3,
};

function asLevel(value: string | undefined): Level {
  return value === 'operational' || value === 'degraded' || value === 'major_outage'
    ? value
    : 'unknown';
}

function worst(levels: Level[]): Level {
  return levels.reduce<Level>(
    (acc, level) => (LEVEL_RANK[level] > LEVEL_RANK[acc] ? level : acc),
    'unknown'
  );
}

type Tile = {
  id: string;
  icon: IconName;
  title: string;
  level: Level;
  lines: string[];
  chips?: { label: string; tone: OpsTone }[];
};

export function HealthView({ initial }: { initial: HealthSnapshot }) {
  const { t, locale } = useOperatorPreferences();
  const [snapshot, setSnapshot] = useState<HealthSnapshot>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [auto, setAuto] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setRefreshing(true);
    try {
      const res = await fetch('/api/operator/health', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error('health fetch failed');
      }
      setSnapshot((await res.json()) as HealthSnapshot);
      setStale(false);
    } catch {
      if (!controller.signal.aborted) {
        setStale(true);
      }
    } finally {
      if (!controller.signal.aborted) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!auto) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, HEALTH_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [auto, refresh]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(tick);
      inflight.current?.abort();
    };
  }, []);

  const { summary, ready, ai, feed } = snapshot;
  const components = summary?.statusPage.components ?? {};
  const metrics = summary?.metrics ?? {};
  const num = (value: number | undefined) =>
    typeof value === 'number' ? value.toLocaleString(locale === 'tr' ? 'tr-TR' : 'en-GB') : '—';
  const ms = (value: number | null | undefined) =>
    typeof value === 'number' ? t('web.health.latency').replace('{ms}', String(value)) : null;
  const state = (value: string | undefined) => {
    if (value === 'up') return t('web.health.stateUp');
    if (value === 'down') return t('web.health.stateDown');
    return t('web.health.levelUnknown');
  };

  const dbLevel: Level = (() => {
    const fromSummary = asLevel(components.database);
    const fromReady: Level =
      ready?.database === 'up'
        ? 'operational'
        : ready?.database === 'down'
          ? 'major_outage'
          : 'unknown';
    return worst([fromSummary, fromReady]);
  })();

  const storageLevel: Level =
    ready?.storage === 'up'
      ? 'operational'
      : ready?.storage === 'down'
        ? 'major_outage'
        : 'unknown';

  const aiLevel: Level = !ai
    ? 'unknown'
    : ai.circuitState === 'open'
      ? 'major_outage'
      : !ai.enabled || ai.circuitState === 'half_open' || ai.circuitState === 'half-open'
        ? 'degraded'
        : 'operational';

  const feedLevel: Level = !feed ? 'unknown' : feed.reachable ? 'operational' : 'major_outage';

  const tiles: Tile[] = [
    {
      id: 'api',
      icon: 'server',
      title: t('web.health.tileApi'),
      level: asLevel(components.api),
      lines: [
        ms(snapshot.apiLatencyMs),
        t('web.health.httpErrors').replace('{count}', num(metrics.httpErrors)),
      ].filter((line): line is string => Boolean(line)),
    },
    {
      id: 'db',
      icon: 'database',
      title: t('web.health.tileDatabase'),
      level: dbLevel,
      lines: [t('web.health.connection').replace('{state}', state(ready?.database))],
    },
    {
      id: 'worker',
      icon: 'bolt',
      title: t('web.health.tileWorker'),
      level: asLevel(components.aiWorker),
      lines: [
        t('web.health.queueDepth').replace('{count}', num(metrics.aiQueueDepth)),
        t('web.health.failures').replace('{count}', num(metrics.aiFailures)),
      ],
    },
    {
      id: 'storage',
      icon: 'archive',
      title: t('web.health.tileStorage'),
      level: storageLevel,
      lines: [t('web.health.connection').replace('{state}', state(ready?.storage))],
    },
    {
      id: 'ai',
      icon: 'sparkles',
      title: t('web.health.tileAi'),
      level: aiLevel,
      lines: ai
        ? [
            ai.enabled ? t('web.health.aiEnabled') : t('web.health.aiDisabled'),
            t('web.health.circuit').replace('{state}', ai.circuitState),
            t('web.health.budget')
              .replace('{used}', num(ai.budgetUsedToday))
              .replace('{limit}', num(ai.budgetDailyLimit)),
          ]
        : [],
      chips: ai
        ? Object.entries(ai.modelsAvailable).map(([name, ok]) => ({
            label: name,
            tone: ok ? ('ok' as const) : ('muted' as const),
          }))
        : undefined,
    },
    {
      id: 'sse',
      icon: 'pulse',
      title: t('web.health.tileSse'),
      level: feedLevel,
      lines: [
        feed
          ? feed.reachable
            ? t('web.health.feedReachable')
            : t('web.health.feedUnreachable')
          : null,
        ms(feed?.latencyMs),
      ].filter((line): line is string => Boolean(line)),
    },
  ];

  const overall: Level = summary
    ? worst([asLevel(summary.statusPage.overall), ...tiles.map((tile) => tile.level)])
    : worst(tiles.map((tile) => tile.level));

  const fetchedMs = new Date(snapshot.fetchedAt).getTime();
  const ageSeconds = Math.max(0, Math.round((now - fetchedMs) / 1000));
  const dateLocale = locale === 'tr' ? 'tr-TR' : 'en-GB';

  const metricRows: { key: string; label: string; value: number | undefined }[] = [
    {
      key: 'ingestAccepted',
      label: t('web.health.metricIngestAccepted'),
      value: metrics.ingestAccepted,
    },
    { key: 'ingestDedup', label: t('web.health.metricIngestDedup'), value: metrics.ingestDedup },
    { key: 'radioAck', label: t('web.health.metricRadioAck'), value: metrics.radioAck },
    { key: 'serverAck', label: t('web.health.metricServerAck'), value: metrics.serverAck },
    { key: 'aiQueueDepth', label: t('web.health.metricAiQueue'), value: metrics.aiQueueDepth },
    { key: 'aiFailures', label: t('web.health.metricAiFailures'), value: metrics.aiFailures },
    { key: 'httpErrors', label: t('web.health.metricHttpErrors'), value: metrics.httpErrors },
  ];

  return (
    <main className="cd2 ops-page health-view" data-testid="operator-health-page">
      <OpsHeader
        icon="pulse"
        title={t('web.health.title')}
        subtitle={t('web.health.subtitle')}
        actions={
          <>
            <label className="ops-switch">
              <input
                type="checkbox"
                checked={auto}
                onChange={(event) => setAuto(event.target.checked)}
                data-testid="health-auto-refresh"
              />
              <span>
                {t('web.health.autoRefresh').replace('{seconds}', String(HEALTH_REFRESH_MS / 1000))}
              </span>
            </label>
            <button
              type="button"
              className="cd2-btn"
              onClick={() => void refresh()}
              disabled={refreshing}
              data-testid="health-refresh"
            >
              <Icon name="refresh" size={14} />
              {refreshing ? t('common.loading') : t('common.refresh')}
            </button>
          </>
        }
      />

      <section
        className={`ops-health-banner ops-health-banner--${LEVEL_TONE[overall]}`}
        data-testid="health-overall"
        data-status={overall}
        role="status"
      >
        <span className="ops-health-banner__dot" aria-hidden="true" />
        <div className="ops-health-banner__text">
          <strong>{t('web.health.overall').replace('{status}', t(LEVEL_KEY[overall]))}</strong>
          <span className="ops-muted" data-testid="health-updated">
            {t('web.health.lastUpdated')
              .replace('{time}', new Date(snapshot.fetchedAt).toLocaleTimeString(dateLocale))
              .replace('{seconds}', String(ageSeconds))}
          </span>
        </div>
        {stale ? (
          <OpsChip tone="warn" icon="alert" testId="health-stale">
            {t('web.health.stale')}
          </OpsChip>
        ) : null}
      </section>

      {!summary ? (
        <p className="ops-notice" data-testid="health-summary-unavailable" role="alert">
          <Icon name="alert" size={16} />
          {t('web.health.summaryUnavailable')}
        </p>
      ) : null}

      <div className="ops-health-grid" data-testid="health-tiles">
        {tiles.map((tile) => (
          <article
            key={tile.id}
            className={`cd2-card ops-health-tile ops-health-tile--${LEVEL_TONE[tile.level]}`}
            data-testid={`health-tile-${tile.id}`}
            data-status={tile.level}
          >
            <header className="ops-health-tile__head">
              <span className="cd2-card__icon">
                <Icon name={tile.icon} size={16} />
              </span>
              <h2 className="cd2-card__title">{tile.title}</h2>
              <OpsChip tone={LEVEL_TONE[tile.level]}>{t(LEVEL_KEY[tile.level])}</OpsChip>
            </header>
            <ul className="ops-health-tile__lines">
              {tile.lines.length === 0 ? (
                <li className="ops-muted">{t('web.health.noData')}</li>
              ) : (
                tile.lines.map((line) => <li key={line}>{line}</li>)
              )}
            </ul>
            {tile.chips && tile.chips.length > 0 ? (
              <div className="ops-chiprow ops-chiprow--tight">
                {tile.chips.map((chip) => (
                  <OpsChip key={chip.label} tone={chip.tone}>
                    {chip.label}
                  </OpsChip>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <section className="cd2-card" aria-label={t('web.health.metrics')}>
        <header className="cd2-card__header">
          <span className="cd2-card__icon">
            <Icon name="list" size={16} />
          </span>
          <h2 className="cd2-card__title">{t('web.health.metrics')}</h2>
          {summary ? (
            <span className="ops-muted">
              {t('web.health.statusAsOf').replace(
                '{time}',
                new Date(summary.statusPage.updatedAt).toLocaleTimeString(dateLocale)
              )}
            </span>
          ) : null}
        </header>
        <div className="cd2-card__body">
          <dl className="ops-metrics" data-testid="health-metrics">
            {metricRows.map((row) => (
              <div key={row.key} className="ops-metric">
                <dt>{row.label}</dt>
                <dd>{num(row.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <p className="ops-hint">
        <Icon name="shield" size={14} />
        {t('web.health.rbacNote')}
      </p>
    </main>
  );
}

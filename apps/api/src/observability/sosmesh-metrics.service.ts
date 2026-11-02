import { Injectable } from '@nestjs/common';

type Histogram = {
  sum: number;
  count: number;
  buckets: Map<number, number>;
};

function newHistogram(): Histogram {
  return { sum: 0, count: 0, buckets: new Map() };
}

const DEFAULT_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

@Injectable()
export class SosMeshMetricsService {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, Histogram>();

  resetForTests(): void {
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  incrementCounter(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  observeHistogram(name: string, valueSeconds: number, buckets = DEFAULT_BUCKETS): void {
    const hist = this.histograms.get(name) ?? newHistogram();
    hist.sum += valueSeconds;
    hist.count += 1;
    for (const le of buckets) {
      if (valueSeconds <= le) {
        hist.buckets.set(le, (hist.buckets.get(le) ?? 0) + 1);
      }
    }
    hist.buckets.set(Number.POSITIVE_INFINITY, hist.count);
    this.histograms.set(name, hist);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getGauge(name: string): number {
    return this.gauges.get(name) ?? 0;
  }

  recordHttpStatus(status: number): void {
    const family = status >= 500 ? '5xx' : status >= 400 ? '4xx' : '2xx';
    this.incrementCounter(`sosmesh_http_responses_total{status_class="${family}"}`);
    if (status >= 500) {
      this.incrementCounter('sosmesh_http_errors_total');
    }
  }

  recordIngestValid(): void {
    this.incrementCounter('sosmesh_ingest_valid_total');
  }

  recordIngestAccepted(): void {
    this.incrementCounter('sosmesh_ingest_accepted_total');
  }

  recordIngestDedup(): void {
    this.incrementCounter('sosmesh_ingest_dedup_total');
  }

  recordIngestRateLimited(): void {
    this.incrementCounter('sosmesh_ingest_rate_limited_total');
  }

  recordRadioAck(): void {
    this.incrementCounter('sosmesh_radio_ack_total');
  }

  recordServerAck(): void {
    this.incrementCounter('sosmesh_server_ack_total');
  }

  recordAiFailure(): void {
    this.incrementCounter('sosmesh_ai_failures_total');
  }

  setAiQueueDepth(depth: number): void {
    this.setGauge('sosmesh_ai_job_queue_depth', depth);
  }

  setWorkerStuckSeconds(seconds: number): void {
    this.setGauge('sosmesh_ai_worker_stuck_seconds', seconds);
  }

  observeUserLagPeer(seconds: number): void {
    this.observeHistogram('sosmesh_user_visible_lag_peer_seconds', seconds);
  }

  observeUserLagServer(seconds: number): void {
    this.observeHistogram('sosmesh_user_visible_lag_server_seconds', seconds);
  }

  observeHttpDuration(route: string, seconds: number): void {
    this.observeHistogram(`sosmesh_http_request_duration_seconds{route="${route}"}`, seconds);
  }

  setDatabaseUp(up: boolean): void {
    this.setGauge('sosmesh_health_database_up', up ? 1 : 0);
  }

  renderPrometheusText(): string {
    const lines: string[] = [];
    const counterNames = new Set<string>();
    for (const name of this.counters.keys()) {
      counterNames.add(name.split('{')[0] ?? name);
    }
    for (const base of [...counterNames].sort()) {
      lines.push(`# TYPE ${base} counter`);
      for (const [name, value] of [...this.counters.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if ((name.split('{')[0] ?? name) === base) {
          lines.push(`${name} ${value}`);
        }
      }
    }
    const gaugeNames = new Set<string>();
    for (const name of this.gauges.keys()) {
      gaugeNames.add(name.split('{')[0] ?? name);
    }
    for (const base of [...gaugeNames].sort()) {
      lines.push(`# TYPE ${base} gauge`);
      for (const [name, value] of [...this.gauges.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        if ((name.split('{')[0] ?? name) === base) {
          lines.push(`${name} ${value}`);
        }
      }
    }
    for (const [name, hist] of [...this.histograms.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const base = name.split('{')[0] ?? name;
      lines.push(`# TYPE ${base} histogram`);
      lines.push(`${base}_sum ${hist.sum}`);
      lines.push(`${base}_count ${hist.count}`);
    }
    return `${lines.join('\n')}\n`;
  }

  snapshotForAlerts(): {
    httpErrors5m: number;
    databaseUp: number;
    aiQueueDepth: number;
    aiFailures5m: number;
    ingestRateLimited5m: number;
    gpsAnomaly5m: number;
  } {
    return {
      httpErrors5m: this.getCounter('sosmesh_http_errors_total'),
      databaseUp: this.getGauge('sosmesh_health_database_up'),
      aiQueueDepth: this.getGauge('sosmesh_ai_job_queue_depth'),
      aiFailures5m: this.getCounter('sosmesh_ai_failures_total'),
      ingestRateLimited5m: this.getCounter('sosmesh_ingest_rate_limited_total'),
      gpsAnomaly5m: this.getCounter('sosmesh_gps_anomaly_total'),
    };
  }

  recordGpsAnomaly(): void {
    this.incrementCounter('sosmesh_gps_anomaly_total');
  }
}

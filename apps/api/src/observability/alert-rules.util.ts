export type AlertSnapshot = {
  httpErrors5m: number;
  databaseUp: number;
  aiQueueDepth: number;
  aiFailures5m: number;
  ingestRateLimited5m: number;
  gpsAnomaly5m: number;
  workerStuckSeconds: number;
};

export type AlertEvaluation = {
  name: string;
  firing: boolean;
  reason: string;
};

export function evaluatePrometheusAlerts(snapshot: AlertSnapshot): AlertEvaluation[] {
  const results: AlertEvaluation[] = [];

  results.push({
    name: 'SosmeshApiDown',
    firing: snapshot.databaseUp === 0,
    reason:
      snapshot.databaseUp === 0
        ? 'sosmesh_health_database_up == 0 (ready probe / DB unavailable)'
        : 'database gauge healthy',
  });

  results.push({
    name: 'SosmeshHighHttpErrorRate',
    firing: snapshot.httpErrors5m >= 3,
    reason:
      snapshot.httpErrors5m >= 3
        ? `sosmesh_http_errors_total increase ${snapshot.httpErrors5m} >= 3`
        : 'HTTP 5xx counter below threshold',
  });

  results.push({
    name: 'SosmeshAiWorkerStuck',
    firing: snapshot.workerStuckSeconds >= 120 && snapshot.aiQueueDepth > 0,
    reason:
      snapshot.workerStuckSeconds >= 120 && snapshot.aiQueueDepth > 0
        ? 'queue depth > 0 with no progress for 120s'
        : 'worker queue moving or empty',
  });

  results.push({
    name: 'SosmeshAiFailuresElevated',
    firing: snapshot.aiFailures5m >= 5,
    reason:
      snapshot.aiFailures5m >= 5
        ? `sosmesh_ai_failures_total ${snapshot.aiFailures5m} >= 5`
        : 'AI failure counter nominal',
  });

  results.push({
    name: 'SosmeshIngestQueueBallooning',
    firing: snapshot.aiQueueDepth >= 50,
    reason:
      snapshot.aiQueueDepth >= 50
        ? `sosmesh_ai_job_queue_depth ${snapshot.aiQueueDepth} >= 50`
        : 'AI async queue depth nominal',
  });

  results.push({
    name: 'SosmeshGpsAnomalyBurst',
    firing: snapshot.gpsAnomaly5m >= 10,
    reason:
      snapshot.gpsAnomaly5m >= 10
        ? `sosmesh_gps_anomaly_total ${snapshot.gpsAnomaly5m} >= 10`
        : 'GPS anomaly counter nominal',
  });

  return results;
}

export function alertsRecovered(previous: AlertEvaluation[], current: AlertEvaluation[]): boolean {
  const prevFiring = new Set(previous.filter((a) => a.firing).map((a) => a.name));
  if (prevFiring.size === 0) {
    return false;
  }
  for (const name of prevFiring) {
    const now = current.find((entry) => entry.name === name);
    if (now?.firing) {
      return false;
    }
  }
  return true;
}

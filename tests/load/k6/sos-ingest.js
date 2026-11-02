import { check } from 'k6';
import http from 'k6/http';

const baseUrl = __ENV.BASE_URL || 'http://127.0.0.1:3001';
const payloadFile = __ENV.PAYLOAD_FILE;
const profileSize = Number(__ENV.PROFILE_SIZE || '100');
const vus = Number(__ENV.K6_VUS || Math.min(10, profileSize));

if (!payloadFile) {
  throw new Error('PAYLOAD_FILE env is required');
}

const payloads = JSON.parse(open(payloadFile));

export const options = {
  scenarios: {
    sos_ingest: {
      executor: 'shared-iterations',
      vus,
      iterations: profileSize,
      maxDuration: '10m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function ingestOnce() {
  const body = payloads[__ITER % payloads.length];
  const res = http.post(`${baseUrl}/v1/ingest`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /v1/ingest' },
  });
  check(res, {
    'ingest status 200': (r) => r.status === 200,
  });
}

function formatSummaryLine(data) {
  const failed = data?.metrics?.http_req_failed?.values?.rate;
  const p95 = data?.metrics?.http_req_duration?.values?.['p(95)'];
  const count = data?.metrics?.iterations?.values?.count;
  return [
    `iterations=${count ?? 'n/a'}`,
    `http_req_failed_rate=${failed ?? 'n/a'}`,
    `http_req_duration_p95_ms=${p95 ?? 'n/a'}`,
  ].join(' ');
}

export function handleSummary(data) {
  const outPath = __ENV.K6_SUMMARY_JSON || 'tests/load/.generated/k6-summary.json';
  return {
    stdout: `${formatSummaryLine(data)}\n`,
    [outPath]: JSON.stringify(data, null, 2),
  };
}

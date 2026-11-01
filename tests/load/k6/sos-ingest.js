import http from 'k6/http';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';

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

export function handleSummary(data) {
  const outPath = __ENV.K6_SUMMARY_JSON || 'tests/load/.generated/k6-summary.json';
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: false }),
    [outPath]: JSON.stringify(data, null, 2),
  };
}

#!/usr/bin/env bash
# Fetch operator-visible API trace for one correlation id (SOS message UUID).
# Only talks to local/test API hosts; requires bearer token from environment.
set -euo pipefail

usage() {
  echo "Usage: $0 <correlation-id>" >&2
  echo "Env: SOSMESH_API_URL (default http://127.0.0.1:3001)" >&2
  echo "     OPERATOR_BEARER_TOKEN (required)" >&2
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 2
fi

CORRELATION_ID="$1"
API_URL="${SOSMESH_API_URL:-http://127.0.0.1:3001}"
TOKEN="${OPERATOR_BEARER_TOKEN:-}"

if [[ "$TOKEN" == "" ]]; then
  echo "ERROR: OPERATOR_BEARER_TOKEN is not set." >&2
  exit 3
fi

case "$API_URL" in
  http://127.0.0.1:*|http://localhost:*|http://0.0.0.0:*)
    ;;
  *)
    echo "ERROR: Refusing non-local API host ($API_URL). Set SOSMESH_API_URL to localhost for M0 trace export." >&2
    exit 4
    ;;
esac

auth_header=( -H "Authorization: Bearer ${TOKEN}" -H "Accept: application/json" )

list_json="$(curl -fsS "${auth_header[@]}" "${API_URL}/v1/operator/cases?search=${CORRELATION_ID}&limit=20")"
incident_id="$(node -e "
const rows = JSON.parse(process.argv[1]).items || [];
const hit = rows.find(r => r.messageId === process.argv[2] || r.sosMessageId === process.argv[2]);
if (!hit) process.exit(1);
process.stdout.write(hit.incidentId);
" "$list_json" "$CORRELATION_ID")"

detail_json="$(curl -fsS "${auth_header[@]}" "${API_URL}/v1/operator/cases/${incident_id}/detail")"
audit_json="$(curl -fsS "${auth_header[@]}" "${API_URL}/v1/operator/cases/${incident_id}/audit")"
events_json="$(curl -fsS "${auth_header[@]}" "${API_URL}/v1/operator/events?after=0")"

node -e "
const correlation = process.argv[1];
const detail = JSON.parse(process.argv[2]);
const audit = JSON.parse(process.argv[3]);
const events = JSON.parse(process.argv[4]);
const filteredEvents = (events.events || []).filter((ev) =>
  JSON.stringify(ev).includes(correlation) || ev.messageId === correlation
);
const out = {
  correlationId: correlation,
  incidentId: detail.incidentId,
  deliveryState: detail.deliveryState,
  timeline: detail.timeline,
  audit: audit.items,
  feedEvents: filteredEvents,
  exportedAt: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
" "$CORRELATION_ID" "$detail_json" "$audit_json" "$events_json"

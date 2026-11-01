-- ADIM 47: EXPLAIN snippets for operator hot paths (run against local postgres after migrate).

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, priority, received_at
FROM sos_messages
ORDER BY priority ASC, received_at DESC
LIMIT 51;

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT seq, message_id, incident_id, priority, occurred_at
FROM operator_feed_events
WHERE seq > 0
ORDER BY seq ASC
LIMIT 100;

-- Read replica decision: at measured CI/VM scale the feed poll remains index-friendly on primary.
-- Re-evaluate only after ERTELENDİ 10k profile on hardware sized for production.

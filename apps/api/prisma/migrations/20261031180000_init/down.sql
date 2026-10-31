-- Rollback for 20261031180000_init (manual down migration for tests)

DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;

DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "assignments" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "teams" CASCADE;
DROP TABLE IF EXISTS "ai_analyses" CASCADE;
DROP TABLE IF EXISTS "operator_feed_events" CASCADE;
DROP TABLE IF EXISTS "relay_receipts" CASCADE;
DROP TABLE IF EXISTS "message_events" CASCADE;
DROP TABLE IF EXISTS "sos_messages" CASCADE;
DROP TABLE IF EXISTS "incidents" CASCADE;

DROP TYPE IF EXISTS "UserRole";
DROP TYPE IF EXISTS "SosType";
DROP TYPE IF EXISTS "LocationStatus";
DROP TYPE IF EXISTS "IncidentState";
DROP TYPE IF EXISTS "DeliveryState";

-- CreateEnum
CREATE TYPE "DeliveryState" AS ENUM ('LOCAL_SAVED', 'PEER_RECEIVED', 'SERVER_ACCEPTED', 'OPERATOR_SEEN', 'CASE_IN_PROGRESS', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IncidentState" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('UNKNOWN', 'GPS', 'MANUAL');

-- CreateEnum
CREATE TYPE "SosType" AS ENUM ('GENERAL', 'MEDICAL', 'TRAPPED', 'FIRE', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OPERATOR', 'ADMIN', 'COORDINATOR');

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "state" "IncidentState" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sos_messages" (
    "id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "incident_id" UUID NOT NULL,
    "delivery_state" "DeliveryState" NOT NULL DEFAULT 'LOCAL_SAVED',
    "sos_type" "SosType" NOT NULL DEFAULT 'GENERAL',
    "location_status" "LocationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracy_meters" DOUBLE PRECISION,
    "encrypted_note_blob" TEXT,
    "encrypted_payload_ref" TEXT,
    "person_count" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sos_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_events" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "delivery_state" "DeliveryState" NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata_json" JSONB,

    CONSTRAINT "message_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relay_receipts" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "relay_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hop_count" INTEGER NOT NULL DEFAULT 0,
    "receipt_hash" TEXT,

    CONSTRAINT "relay_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "model_version" TEXT NOT NULL,
    "result_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "zone_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "team_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "assignee_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "incident_id" UUID,
    "action" TEXT NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sos_messages_message_id_key" ON "sos_messages"("message_id");

-- CreateIndex
CREATE INDEX "sos_messages_incident_id_idx" ON "sos_messages"("incident_id");

-- CreateIndex
CREATE INDEX "message_events_message_id_created_at_idx" ON "message_events"("message_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "relay_receipts_message_id_relay_id_key" ON "relay_receipts"("message_id", "relay_id");

-- CreateIndex
CREATE INDEX "ai_analyses_incident_id_idx" ON "ai_analyses"("incident_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "assignments_incident_id_idx" ON "assignments"("incident_id");

-- CreateIndex
CREATE INDEX "assignments_team_id_idx" ON "assignments"("team_id");

-- CreateIndex
CREATE INDEX "audit_logs_incident_id_idx" ON "audit_logs"("incident_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "sos_messages" ADD CONSTRAINT "sos_messages_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "sos_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relay_receipts" ADD CONSTRAINT "relay_receipts_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "sos_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;


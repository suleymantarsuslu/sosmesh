-- ADIM 27/28: work tasks, resources, location share, operator notifications

CREATE TYPE "ResourceKind" AS ENUM ('FIELD_TEAM', 'VEHICLE', 'EQUIPMENT', 'SHELTER');
CREATE TYPE "WorkTaskStatus" AS ENUM ('PROPOSED', 'ASSIGNED', 'ACCEPTED', 'WITHDRAWN', 'CLOSED');
CREATE TYPE "WorkTaskSource" AS ENUM ('MANUAL', 'AI');
CREATE TYPE "NotificationDeliveryState" AS ENUM ('PENDING', 'DELIVERED', 'SKIPPED_QUIET_HOURS', 'FAILED');

CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "team_id" UUID,
    "kind" "ResourceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "zone_code" TEXT,
    "available_from" TIMESTAMP(3),
    "available_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_tasks" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "resource_id" UUID,
    "assignee_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'PROPOSED',
    "source" "WorkTaskSource" NOT NULL DEFAULT 'MANUAL',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "location_share_grants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),

    CONSTRAINT "location_share_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operator_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "delivery_state" "NotificationDeliveryState" NOT NULL DEFAULT 'PENDING',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "timezone_offset_min" INTEGER NOT NULL DEFAULT 180,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "notification_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resources_organization_id_idx" ON "resources"("organization_id");
CREATE INDEX "resources_team_id_idx" ON "resources"("team_id");
CREATE INDEX "work_tasks_incident_id_idx" ON "work_tasks"("incident_id");
CREATE INDEX "work_tasks_team_id_idx" ON "work_tasks"("team_id");
CREATE INDEX "work_tasks_status_idx" ON "work_tasks"("status");
CREATE INDEX "location_share_grants_user_id_expires_at_idx" ON "location_share_grants"("user_id", "expires_at");
CREATE INDEX "location_share_grants_team_id_idx" ON "location_share_grants"("team_id");
CREATE UNIQUE INDEX "operator_notifications_user_id_dedupe_key_key" ON "operator_notifications"("user_id", "dedupe_key");
CREATE INDEX "operator_notifications_user_id_created_at_idx" ON "operator_notifications"("user_id", "created_at");
CREATE UNIQUE INDEX "notification_subscriptions_user_id_event_type_key" ON "notification_subscriptions"("user_id", "event_type");

ALTER TABLE "resources" ADD CONSTRAINT "resources_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "location_share_grants" ADD CONSTRAINT "location_share_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "location_share_grants" ADD CONSTRAINT "location_share_grants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operator_notifications" ADD CONSTRAINT "operator_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

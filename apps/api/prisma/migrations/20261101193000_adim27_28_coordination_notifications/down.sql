ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "notification_preferences_user_id_fkey";
ALTER TABLE "operator_notifications" DROP CONSTRAINT IF EXISTS "operator_notifications_user_id_fkey";
ALTER TABLE "location_share_grants" DROP CONSTRAINT IF EXISTS "location_share_grants_team_id_fkey";
ALTER TABLE "location_share_grants" DROP CONSTRAINT IF EXISTS "location_share_grants_user_id_fkey";
ALTER TABLE "work_tasks" DROP CONSTRAINT IF EXISTS "work_tasks_assignee_id_fkey";
ALTER TABLE "work_tasks" DROP CONSTRAINT IF EXISTS "work_tasks_resource_id_fkey";
ALTER TABLE "work_tasks" DROP CONSTRAINT IF EXISTS "work_tasks_team_id_fkey";
ALTER TABLE "work_tasks" DROP CONSTRAINT IF EXISTS "work_tasks_incident_id_fkey";
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_team_id_fkey";
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_organization_id_fkey";

DROP TABLE IF EXISTS "notification_subscriptions";
DROP TABLE IF EXISTS "notification_preferences";
DROP TABLE IF EXISTS "operator_notifications";
DROP TABLE IF EXISTS "location_share_grants";
DROP TABLE IF EXISTS "work_tasks";
DROP TABLE IF EXISTS "resources";

DROP TYPE IF EXISTS "NotificationDeliveryState";
DROP TYPE IF EXISTS "WorkTaskSource";
DROP TYPE IF EXISTS "WorkTaskStatus";
DROP TYPE IF EXISTS "ResourceKind";

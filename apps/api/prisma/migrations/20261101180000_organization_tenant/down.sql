ALTER TABLE "teams" DROP CONSTRAINT IF EXISTS "teams_organization_id_fkey";
DROP INDEX IF EXISTS "teams_organization_id_idx";
ALTER TABLE "teams" DROP COLUMN IF EXISTS "organization_id";
DROP TABLE IF EXISTS "organizations";

-- ADIM 26: multi-organization tenant boundary (teams belong to an organization)

CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

INSERT INTO "organizations" ("id", "name", "slug", "created_at")
VALUES (
    '00000000-0000-4000-8000-0000000000f0',
    'Default Organization',
    'default-org',
    CURRENT_TIMESTAMP
);

ALTER TABLE "teams" ADD COLUMN "organization_id" UUID;

UPDATE "teams" SET "organization_id" = '00000000-0000-4000-8000-0000000000f0'
WHERE "organization_id" IS NULL;

ALTER TABLE "teams" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

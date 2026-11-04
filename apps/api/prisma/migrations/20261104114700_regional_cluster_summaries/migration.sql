-- CreateTable
CREATE TABLE "regional_cluster_summaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cluster_key" VARCHAR(200) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "summary" TEXT,
    "last_error" TEXT,
    "incident_ids" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regional_cluster_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regional_cluster_summaries_cluster_key_key" ON "regional_cluster_summaries"("cluster_key");

-- CreateIndex
CREATE INDEX "regional_cluster_summaries_status_idx" ON "regional_cluster_summaries"("status");

-- CreateIndex
CREATE INDEX "regional_cluster_summaries_expires_at_idx" ON "regional_cluster_summaries"("expires_at");

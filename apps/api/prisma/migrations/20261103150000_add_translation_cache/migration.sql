-- CreateTable
CREATE TABLE "ai_translation_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID NOT NULL,
    "source_field" VARCHAR(100) NOT NULL,
    "source_language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "translated_text" TEXT NOT NULL,
    "model_version" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_translation_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_translation_cache_unique" ON "ai_translation_cache"("source_type", "source_id", "source_field", "target_language");

-- CreateIndex
CREATE INDEX "ai_translation_cache_source_idx" ON "ai_translation_cache"("source_type", "source_id");

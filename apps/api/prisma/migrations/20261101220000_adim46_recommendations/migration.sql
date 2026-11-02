-- CreateEnum
CREATE TYPE "AssignmentRecommendationStatus" AS ENUM ('PROPOSED', 'REJECTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "RecommendationFeedbackRating" AS ENUM ('HELPFUL', 'NOT_HELPFUL');

-- CreateTable
CREATE TABLE "assignment_recommendations" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "resource_id" UUID,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "distance_km" DOUBLE PRECISION,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "status" "AssignmentRecommendationStatus" NOT NULL DEFAULT 'PROPOSED',
    "deterministic_note" TEXT NOT NULL,
    "ai_rationale" TEXT,
    "missing_info_json" JSONB NOT NULL,
    "data_freshness_json" JSONB NOT NULL,
    "work_task_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" UUID NOT NULL,
    "recommendation_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "rating" "RecommendationFeedbackRating" NOT NULL,
    "note" TEXT,
    "captured_for_scoring" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_recommendations_work_task_id_key" ON "assignment_recommendations"("work_task_id");

-- CreateIndex
CREATE INDEX "assignment_recommendations_incident_id_status_idx" ON "assignment_recommendations"("incident_id", "status");

-- CreateIndex
CREATE INDEX "assignment_recommendations_team_id_idx" ON "assignment_recommendations"("team_id");

-- CreateIndex
CREATE INDEX "recommendation_feedback_recommendation_id_idx" ON "recommendation_feedback"("recommendation_id");

-- AddForeignKey
ALTER TABLE "assignment_recommendations" ADD CONSTRAINT "assignment_recommendations_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_recommendations" ADD CONSTRAINT "assignment_recommendations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_recommendations" ADD CONSTRAINT "assignment_recommendations_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_recommendations" ADD CONSTRAINT "assignment_recommendations_work_task_id_fkey" FOREIGN KEY ("work_task_id") REFERENCES "work_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "assignment_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

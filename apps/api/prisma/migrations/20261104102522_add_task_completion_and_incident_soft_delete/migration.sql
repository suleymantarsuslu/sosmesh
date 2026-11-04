-- AlterTable
ALTER TABLE "incidents" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_tasks" ADD COLUMN "completed_at" TIMESTAMP(3),
ADD COLUMN "completed_by_id" UUID;

-- CreateIndex
CREATE INDEX "incidents_deleted_at_idx" ON "incidents"("deleted_at");

-- CreateIndex
CREATE INDEX "work_tasks_completed_at_idx" ON "work_tasks"("completed_at");

-- AddForeignKey
ALTER TABLE "work_tasks" ADD CONSTRAINT "work_tasks_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

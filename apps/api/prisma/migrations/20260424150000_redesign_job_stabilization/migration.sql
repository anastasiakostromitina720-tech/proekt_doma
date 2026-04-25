-- AlterTable
ALTER TABLE "redesign_jobs" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'mock',
ADD COLUMN     "externalJobId" TEXT,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "redesign_jobs_status_startedAt_idx" ON "redesign_jobs"("status", "startedAt");

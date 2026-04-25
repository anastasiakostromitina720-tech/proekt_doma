-- CreateEnum
CREATE TYPE "RedesignJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "redesign_jobs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "sourceMediaId" UUID NOT NULL,
    "resultMediaId" UUID,
    "roomType" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "RedesignJobStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redesign_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "redesign_jobs_projectId_createdAt_idx" ON "redesign_jobs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "redesign_jobs_userId_projectId_idx" ON "redesign_jobs"("userId", "projectId");

-- AddForeignKey
ALTER TABLE "redesign_jobs" ADD CONSTRAINT "redesign_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redesign_jobs" ADD CONSTRAINT "redesign_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

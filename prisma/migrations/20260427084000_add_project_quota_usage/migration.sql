-- Immutable audit log of project creations. Backs daily quota counting so that
-- deleting a project does NOT refund the slot it consumed.

CREATE TABLE "ProjectQuotaUsage" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "projectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectQuotaUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProjectQuotaUsage_userId_createdAt_idx"
  ON "ProjectQuotaUsage" ("userId", "createdAt");

-- Backfill from the existing Project table so users who already created
-- projects today don't have their quota silently reset by the upgrade.
INSERT INTO "ProjectQuotaUsage" ("id", "userId", "projectId", "createdAt")
SELECT gen_random_uuid()::text, "userId", "id", "createdAt"
FROM "Project";

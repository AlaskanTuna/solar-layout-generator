-- Add freshness metadata to TariffConfig (Task 7 / Finding 5).
-- effectiveDate: when the seeded rates/AFA were last verified against TNB sources.
-- sourceNote: short human-readable note about the source publication or revision cycle.
ALTER TABLE "TariffConfig"
ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3);

ALTER TABLE "TariffConfig"
ADD COLUMN IF NOT EXISTS "sourceNote" TEXT;

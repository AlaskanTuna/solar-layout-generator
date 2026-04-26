-- Create ImageryQuality enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImageryQuality') THEN
    CREATE TYPE "ImageryQuality" AS ENUM ('HIGH', 'BASE');
  END IF;
END$$;

-- Add Location.imageryQuality (nullable; existing rows remain NULL until pipeline reruns)
ALTER TABLE "Location"
ADD COLUMN IF NOT EXISTS "imageryQuality" "ImageryQuality";

-- Add Project.layoutPreferences (nullable; sparse JSON: { billRange, sizingGoal, dismissedAt })
ALTER TABLE "Project"
ADD COLUMN IF NOT EXISTS "layoutPreferences" JSONB;

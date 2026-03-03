-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'layout_saved', 'analysis_saved');

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "status" "LocationStatus" NOT NULL DEFAULT 'processing',
    "buildingInsightsJson" JSONB,
    "rgbImageUrl" TEXT,
    "monthlyFluxPath" TEXT,
    "maskPath" TEXT,
    "annualFluxPath" TEXT,
    "dsmPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "editedLayout" JSONB,
    "analysisConfig" JSONB,
    "analysisResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TariffConfig" (
    "id" TEXT NOT NULL,
    "tariffVersion" TEXT NOT NULL,
    "rates" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "eeiTable" JSONB NOT NULL,
    "afaRateDefault" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TariffConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

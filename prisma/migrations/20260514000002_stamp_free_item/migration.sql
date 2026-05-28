-- Add freeItemAvailable to StampCard for 10-stamp reward tracking
ALTER TABLE "StampCard" ADD COLUMN "freeItemAvailable" BOOLEAN NOT NULL DEFAULT false;

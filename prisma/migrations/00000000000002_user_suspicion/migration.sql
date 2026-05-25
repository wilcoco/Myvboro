-- Cheap structural anti-ad signal computed in app code (see
-- src/lib/userScores.ts). Range: 0 (trusted) .. 1 (likely shill).
ALTER TABLE "User" ADD COLUMN "suspicionScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

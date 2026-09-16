-- Per-user dashboard product tour dismissal (nullable; existing users stay null until they finish/skip).
ALTER TABLE "User" ADD COLUMN "dashboardTourCompletedAt" TIMESTAMP(3);

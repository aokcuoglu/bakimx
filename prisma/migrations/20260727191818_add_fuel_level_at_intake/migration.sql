-- AlterEnum
ALTER TYPE "VehiclePhotoType" ADD VALUE 'fuel_gauge';

-- AlterTable
ALTER TABLE "VehicleIntakeForm" ADD COLUMN     "fuelLevelAtIntake" INTEGER;

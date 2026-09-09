-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "defaultReminderDaysBeforeExpiry" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
ADD COLUMN     "employerSessionHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "staffSessionHours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "traineeSessionDays" INTEGER NOT NULL DEFAULT 7;

-- Direct platform-fee billing — a total trainee-seat cap per
-- organization and a SUPER_ADMIN waiver that overrides both the
-- payment-lapse gate and the seat-cap gate at once.

-- AlterTable
ALTER TABLE "TrainingOrganization" ADD COLUMN "trainingSeatCap" INTEGER;
ALTER TABLE "TrainingOrganization" ADD COLUMN "accessBlockWaived" BOOLEAN NOT NULL DEFAULT false;

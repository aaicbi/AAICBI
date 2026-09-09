-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "googleId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_googleId_key" ON "Trainee"("googleId");

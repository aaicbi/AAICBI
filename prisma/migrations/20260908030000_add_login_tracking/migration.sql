-- AlterTable
ALTER TABLE "Employer" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "previousLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "previousLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "previousLoginAt" TIMESTAMP(3);


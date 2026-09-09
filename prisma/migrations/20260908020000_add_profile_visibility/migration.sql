-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'EMPLOYERS_ONLY', 'PRIVATE');

-- AlterTable
ALTER TABLE "Employer" ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'AUTHENTICATED';

-- AlterTable
ALTER TABLE "Trainee" ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PRIVATE';


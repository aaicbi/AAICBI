-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "CourseAccessModel" AS ENUM ('RECURRING_SUBSCRIPTION', 'FIXED_DURATION');

-- CreateEnum
CREATE TYPE "AccessDurationUnit" AS ENUM ('DAYS', 'MONTHS', 'LIFETIME');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "accessDurationUnit" "AccessDurationUnit",
ADD COLUMN     "accessDurationValue" INTEGER,
ADD COLUMN     "accessModel" "CourseAccessModel" NOT NULL DEFAULT 'RECURRING_SUBSCRIPTION',
ADD COLUMN     "reminderDaysBeforeExpiry" INTEGER[] DEFAULT ARRAY[7, 3, 1]::INTEGER[],
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CourseEnrollment" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "reference" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentReminderSent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "daysBeforeExpiry" INTEGER NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessExtension" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "extendedById" TEXT NOT NULL,
    "previousPeriodEnd" TIMESTAMP(3),
    "newPeriodEnd" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "extendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessExtension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_traineeId_courseId_idx" ON "Payment"("traineeId", "courseId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentReminderSent_enrollmentId_periodEnd_daysBeforeExp_key" ON "EnrollmentReminderSent"("enrollmentId", "periodEnd", "daysBeforeExpiry");

-- CreateIndex
CREATE INDEX "AccessExtension_enrollmentId_idx" ON "AccessExtension"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentReminderSent" ADD CONSTRAINT "EnrollmentReminderSent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessExtension" ADD CONSTRAINT "AccessExtension_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CourseEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessExtension" ADD CONSTRAINT "AccessExtension_extendedById_fkey" FOREIGN KEY ("extendedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "ArenaChatMessage" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "deletedReason" TEXT,

    CONSTRAINT "ArenaChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaSuspension" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "reason" TEXT,
    "suspendedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,

    CONSTRAINT "ArenaSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaChatMessage_courseId_createdAt_idx" ON "ArenaChatMessage"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaChatMessage_senderId_createdAt_idx" ON "ArenaChatMessage"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaSuspension_courseId_traineeId_idx" ON "ArenaSuspension"("courseId", "traineeId");

-- CreateIndex
CREATE INDEX "ArenaSuspension_courseId_liftedAt_idx" ON "ArenaSuspension"("courseId", "liftedAt");

-- AddForeignKey
ALTER TABLE "ArenaChatMessage" ADD CONSTRAINT "ArenaChatMessage_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaChatMessage" ADD CONSTRAINT "ArenaChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSuspension" ADD CONSTRAINT "ArenaSuspension_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaSuspension" ADD CONSTRAINT "ArenaSuspension_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

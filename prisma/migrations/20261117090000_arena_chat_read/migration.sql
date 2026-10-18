-- CreateTable
CREATE TABLE "ArenaChatRead" (
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArenaChatRead_pkey" PRIMARY KEY ("traineeId","courseId")
);

-- AddForeignKey
ALTER TABLE "ArenaChatRead" ADD CONSTRAINT "ArenaChatRead_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaChatRead" ADD CONSTRAINT "ArenaChatRead_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

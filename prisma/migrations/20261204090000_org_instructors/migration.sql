-- Organization instructors: which courses an organization's instructor teaches. Additive only.
CREATE TABLE "TrainingOrganizationMemberCourse" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrainingOrganizationMemberCourse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingOrganizationMemberCourse_memberId_courseId_key" ON "TrainingOrganizationMemberCourse"("memberId", "courseId");
CREATE INDEX "TrainingOrganizationMemberCourse_courseId_idx" ON "TrainingOrganizationMemberCourse"("courseId");
ALTER TABLE "TrainingOrganizationMemberCourse" ADD CONSTRAINT "TrainingOrganizationMemberCourse_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "TrainingOrganizationMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingOrganizationMemberCourse" ADD CONSTRAINT "TrainingOrganizationMemberCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

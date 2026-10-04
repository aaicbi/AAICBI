-- AI-Powered Assignment Generation and Assessment Engine (Phase 1) — a
-- brand-new, self-contained model group alongside the existing
-- Exam/Question/Attempt tables, which this feature never touches.

-- CreateEnum
CREATE TYPE "AssignmentQuestionType" AS ENUM ('SHORT_ANSWER', 'EXPLANATION', 'LONG_ANSWER', 'ESSAY', 'SCENARIO', 'CASE_STUDY', 'PRACTICAL_TASK', 'TECHNICAL_RESPONSE', 'REFLECTION', 'MULTI_PART');
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');
CREATE TYPE "AssignmentSubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'ASSESSMENT_PENDING', 'AI_ASSESSED', 'MANUAL_PENDING', 'INSTRUCTOR_REVIEWED', 'RETURNED', 'RESUBMISSION_REQUIRED', 'COMPLETED');
CREATE TYPE "LateSubmissionPolicy" AS ENUM ('ALLOWED', 'ALLOWED_WITH_FLAG', 'NOT_ALLOWED');
CREATE TYPE "ResubmissionPolicy" AS ENUM ('NONE', 'ONE', 'LIMITED', 'UNLIMITED');
CREATE TYPE "ResubmissionScope" AS ENUM ('FULL_ASSIGNMENT', 'FAILED_QUESTIONS_ONLY');

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "moduleId" TEXT,
    "courseId" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "dueAt" TIMESTAMP(3),
    "lateSubmissionPolicy" "LateSubmissionPolicy" NOT NULL DEFAULT 'ALLOWED',
    "allowEditAfterSubmission" BOOLEAN NOT NULL DEFAULT false,
    "aiAssessmentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "resubmissionPolicy" "ResubmissionPolicy" NOT NULL DEFAULT 'NONE',
    "maxResubmissions" INTEGER,
    "resubmissionScope" "ResubmissionScope" NOT NULL DEFAULT 'FULL_ASSIGNMENT',
    "sourceDocUrl" TEXT,
    "sourceDocUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentQuestion" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "section" TEXT,
    "questionNumber" TEXT NOT NULL,
    "parentQuestionId" TEXT,
    "type" "AssignmentQuestionType" NOT NULL,
    "questionText" TEXT NOT NULL,
    "instructions" TEXT,
    "referenceMaterial" TEXT,
    "expectedAnswer" TEXT,
    "expectedConcepts" JSONB,
    "keywords" JSONB,
    "learningObjective" TEXT,
    "difficulty" TEXT,
    "maxMarks" INTEGER NOT NULL,
    "rubric" JSONB,
    "order" INTEGER NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,

    CONSTRAINT "AssignmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "AssignmentSubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "totalScore" INTEGER,
    "maxScore" INTEGER,
    "percentage" DOUBLE PRECISION,
    "overallFeedback" TEXT,
    "overallStrengths" JSONB,
    "overallAreasForImprovement" JSONB,
    "instructorReviewedById" TEXT,
    "instructorReviewedAt" TIMESTAMP(3),
    "instructorComments" TEXT,
    "instructorDecision" TEXT,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerText" TEXT,
    "lastSavedAt" TIMESTAMP(3),
    "aiScore" INTEGER,
    "aiMaxScore" INTEGER,
    "aiPercentage" DOUBLE PRECISION,
    "aiCriteriaScores" JSONB,
    "aiStrengths" JSONB,
    "aiAreasForImprovement" JSONB,
    "aiFeedback" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiNeedsInstructorReview" BOOLEAN NOT NULL DEFAULT false,
    "aiRawOutput" JSONB,
    "aiAssessedAt" TIMESTAMP(3),
    "instructorScore" INTEGER,
    "instructorFeedback" TEXT,

    CONSTRAINT "AssignmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_moduleId_key" ON "Assignment"("moduleId");
CREATE UNIQUE INDEX "Assignment_courseId_key" ON "Assignment"("courseId");
CREATE INDEX "Assignment_createdById_idx" ON "Assignment"("createdById");

CREATE INDEX "AssignmentQuestion_assignmentId_idx" ON "AssignmentQuestion"("assignmentId");

CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_traineeId_attemptNumber_key" ON "AssignmentSubmission"("assignmentId", "traineeId", "attemptNumber");
CREATE INDEX "AssignmentSubmission_assignmentId_traineeId_idx" ON "AssignmentSubmission"("assignmentId", "traineeId");

CREATE UNIQUE INDEX "AssignmentAnswer_submissionId_questionId_key" ON "AssignmentAnswer"("submissionId", "questionId");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AssignmentQuestion" ADD CONSTRAINT "AssignmentQuestion_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentQuestion" ADD CONSTRAINT "AssignmentQuestion_parentQuestionId_fkey" FOREIGN KEY ("parentQuestionId") REFERENCES "AssignmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_instructorReviewedById_fkey" FOREIGN KEY ("instructorReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AssignmentAnswer" ADD CONSTRAINT "AssignmentAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "AssignmentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentAnswer" ADD CONSTRAINT "AssignmentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "AssignmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

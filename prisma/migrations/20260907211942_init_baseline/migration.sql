-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "EmployerApprovalState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('FREE', 'ADMIN_GRANTED', 'PAID');

-- CreateEnum
CREATE TYPE "IntroductionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "JobPostingStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PDF', 'DOCX', 'PPTX', 'VIDEO');

-- CreateEnum
CREATE TYPE "QaScope" AS ENUM ('OPEN', 'COHORT_SCOPED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR', 'TRAINEE');

-- CreateEnum
CREATE TYPE "TranslationSource" AS ENUM ('GOOGLE_TRANSLATE', 'AI_DRAFTED');

-- CreateTable
CREATE TABLE "AiCreditGrant" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "grantedById" TEXT,
    "reason" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCreditGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionKey" TEXT,
    "isCorrect" BOOLEAN,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "score" INTEGER,
    "totalQuestions" INTEGER,
    "percentage" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "passMarkPercent" INTEGER,
    "questionOrder" JSONB,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "courseExamAttemptId" TEXT,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooldownOverride" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooldownOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "inactivityThresholdDays" INTEGER,
    "failedAttemptsThreshold" INTEGER,
    "aiCreditAllowanceOverride" INTEGER,
    "isFree" BOOLEAN NOT NULL DEFAULT true,
    "priceKobo" INTEGER,
    "billingInterval" "BillingInterval",
    "paystackPlanCode" TEXT,
    "qaScope" "QaScope" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "source" "EnrollmentSource" NOT NULL,
    "enrolledById" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "otpCode" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "unlockedAt" TIMESTAMP(3),
    "accessRevokedAt" TIMESTAMP(3),
    "paystackCustomerCode" TEXT,
    "paystackSubscriptionCode" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),

    CONSTRAINT "CourseEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseReview" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverableCertificate" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,

    CONSTRAINT "DiscoverableCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employer" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "otherSocialUrl" TEXT,
    "approvalState" "EmployerApprovalState" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompletedAt" TIMESTAMP(3),

    CONSTRAINT "Employer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentRecord" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrollmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "course" TEXT,
    "module" TEXT,
    "cohort" TEXT,
    "moduleId" TEXT,
    "instructions" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "passMarkPercent" INTEGER NOT NULL DEFAULT 80,
    "numQuestions" INTEGER,
    "maxAttempts" INTEGER,
    "randomizeQuestions" BOOLEAN NOT NULL DEFAULT true,
    "randomizeOptions" BOOLEAN NOT NULL DEFAULT true,
    "showResultImmediately" BOOLEAN NOT NULL DEFAULT true,
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT false,
    "allowReview" BOOLEAN NOT NULL DEFAULT true,
    "monitoringEnabled" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "courseId" TEXT,
    "retakeCooldownHours" INTEGER,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailedAttemptsAlert" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedAttemptsAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InactivityAlert" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InactivityAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntroductionDisclosedCertificate" (
    "id" TEXT NOT NULL,
    "introductionRequestId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,

    CONSTRAINT "IntroductionDisclosedCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntroductionRequest" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "status" "IntroductionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "includeContactInfo" BOOLEAN,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntroductionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "includeContactInfo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplicationDisclosedCertificate" (
    "id" TEXT NOT NULL,
    "jobApplicationId" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,

    CONSTRAINT "JobApplicationDisclosedCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "closingDate" TIMESTAMP(3) NOT NULL,
    "status" "JobPostingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "aiFlagged" BOOLEAN NOT NULL DEFAULT false,
    "aiFlagReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialDownload" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "materialUpdatedAt" TIMESTAMP(3) NOT NULL,
    "notifiedOfChangeAt" TIMESTAMP(3),

    CONSTRAINT "MaterialDownload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleCompletion" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "relatedId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaystackEvent" (
    "id" TEXT NOT NULL,
    "paystackReference" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaystackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerformanceSummary" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "strengths" JSONB NOT NULL,
    "weaknesses" JSONB NOT NULL,
    "narrative" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "defaultAiCreditAllowance" INTEGER NOT NULL DEFAULT 0,
    "qaWarningsBeforeSuspension" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaModerationAction" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaPost" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "likerType" TEXT NOT NULL,
    "likerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QaThread" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "cohortId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QaThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "topic" TEXT,
    "difficulty" "Difficulty" DEFAULT 'BEGINNER',
    "explanation" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "generatedFromQuestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" vector,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspiciousEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "SuspiciousEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "courseReviewId" TEXT,
    "traineeName" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rating" INTEGER,
    "courseTitle" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trainee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT,
    "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false,
    "whatsappVerifiedAt" TIMESTAMP(3),
    "whatsappOtpCode" TEXT,
    "whatsappOtpExpiresAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "verifyTokenExpiresAt" TIMESTAMP(3),
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "privacyConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowBandwidthMode" BOOLEAN NOT NULL DEFAULT false,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "onboardingCompletedAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "aiStudyBuddyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiCreditBalance" INTEGER NOT NULL DEFAULT 0,
    "qaSuspendedAt" TIMESTAMP(3),
    "publiclyDiscoverable" BOOLEAN NOT NULL DEFAULT false,
    "discoverableHeadline" TEXT,
    "discoverableBio" TEXT,
    "publicProfileCode" TEXT,

    CONSTRAINT "Trainee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UiStringTranslation" (
    "id" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "translatedText" TEXT NOT NULL,
    "source" "TranslationSource" NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UiStringTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INSTRUCTOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetToken" TEXT,
    "resetTokenExpiresAt" TIMESTAMP(3),
    "aiAssistantEnabled" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCreditGrant_traineeId_idx" ON "AiCreditGrant"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "Answer_attemptId_idx" ON "Answer"("attemptId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Answer_attemptId_questionId_key" ON "Answer"("attemptId" ASC, "questionId" ASC);

-- CreateIndex
CREATE INDEX "Attempt_examId_idx" ON "Attempt"("examId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_examId_traineeId_attemptNumber_key" ON "Attempt"("examId" ASC, "traineeId" ASC, "attemptNumber" ASC);

-- CreateIndex
CREATE INDEX "Attempt_traineeId_idx" ON "Attempt"("traineeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Badge_traineeId_courseId_threshold_key" ON "Badge"("traineeId" ASC, "courseId" ASC, "threshold" ASC);

-- CreateIndex
CREATE INDEX "Badge_traineeId_idx" ON "Badge"("traineeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_code_key" ON "Certificate"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_courseExamAttemptId_key" ON "Certificate"("courseExamAttemptId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_traineeId_courseId_key" ON "Certificate"("traineeId" ASC, "courseId" ASC);

-- CreateIndex
CREATE INDEX "Certificate_traineeId_idx" ON "Certificate"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "Cohort_courseId_idx" ON "Cohort"("courseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CooldownOverride_traineeId_examId_key" ON "CooldownOverride"("traineeId" ASC, "examId" ASC);

-- CreateIndex
CREATE INDEX "Course_published_idx" ON "Course"("published" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_paystackSubscriptionCode_key" ON "CourseEnrollment"("paystackSubscriptionCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrollment_traineeId_courseId_key" ON "CourseEnrollment"("traineeId" ASC, "courseId" ASC);

-- CreateIndex
CREATE INDEX "CourseEnrollment_traineeId_idx" ON "CourseEnrollment"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "CourseReview_courseId_idx" ON "CourseReview"("courseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CourseReview_traineeId_courseId_key" ON "CourseReview"("traineeId" ASC, "courseId" ASC);

-- CreateIndex
CREATE INDEX "DiscoverableCertificate_certificateId_idx" ON "DiscoverableCertificate"("certificateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverableCertificate_traineeId_certificateId_key" ON "DiscoverableCertificate"("traineeId" ASC, "certificateId" ASC);

-- CreateIndex
CREATE INDEX "Employer_approvalState_idx" ON "Employer"("approvalState" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Employer_email_key" ON "Employer"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentRecord_cohortId_traineeId_key" ON "EnrollmentRecord"("cohortId" ASC, "traineeId" ASC);

-- CreateIndex
CREATE INDEX "EnrollmentRecord_traineeId_idx" ON "EnrollmentRecord"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "Exam_code_idx" ON "Exam"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_code_key" ON "Exam"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_courseId_key" ON "Exam"("courseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Exam_moduleId_key" ON "Exam"("moduleId" ASC);

-- CreateIndex
CREATE INDEX "FailedAttemptsAlert_examId_idx" ON "FailedAttemptsAlert"("examId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "FailedAttemptsAlert_traineeId_examId_key" ON "FailedAttemptsAlert"("traineeId" ASC, "examId" ASC);

-- CreateIndex
CREATE INDEX "InactivityAlert_courseId_idx" ON "InactivityAlert"("courseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "InactivityAlert_traineeId_courseId_key" ON "InactivityAlert"("traineeId" ASC, "courseId" ASC);

-- CreateIndex
CREATE INDEX "IntroductionDisclosedCertificate_certificateId_idx" ON "IntroductionDisclosedCertificate"("certificateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "IntroductionDisclosedCertificate_introductionRequestId_cert_key" ON "IntroductionDisclosedCertificate"("introductionRequestId" ASC, "certificateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "IntroductionRequest_employerId_traineeId_key" ON "IntroductionRequest"("employerId" ASC, "traineeId" ASC);

-- CreateIndex
CREATE INDEX "IntroductionRequest_status_idx" ON "IntroductionRequest"("status" ASC);

-- CreateIndex
CREATE INDEX "IntroductionRequest_traineeId_idx" ON "IntroductionRequest"("traineeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobPostingId_traineeId_key" ON "JobApplication"("jobPostingId" ASC, "traineeId" ASC);

-- CreateIndex
CREATE INDEX "JobApplication_traineeId_idx" ON "JobApplication"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "JobApplicationDisclosedCertificate_certificateId_idx" ON "JobApplicationDisclosedCertificate"("certificateId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "JobApplicationDisclosedCertificate_jobApplicationId_certifi_key" ON "JobApplicationDisclosedCertificate"("jobApplicationId" ASC, "certificateId" ASC);

-- CreateIndex
CREATE INDEX "JobPosting_closingDate_idx" ON "JobPosting"("closingDate" ASC);

-- CreateIndex
CREATE INDEX "JobPosting_status_idx" ON "JobPosting"("status" ASC);

-- CreateIndex
CREATE INDEX "Lesson_moduleId_idx" ON "Lesson"("moduleId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_lessonId_traineeId_key" ON "LessonProgress"("lessonId" ASC, "traineeId" ASC);

-- CreateIndex
CREATE INDEX "LessonProgress_traineeId_idx" ON "LessonProgress"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "Material_lessonId_idx" ON "Material"("lessonId" ASC);

-- CreateIndex
CREATE INDEX "MaterialDownload_materialId_idx" ON "MaterialDownload"("materialId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MaterialDownload_traineeId_materialId_key" ON "MaterialDownload"("traineeId" ASC, "materialId" ASC);

-- CreateIndex
CREATE INDEX "Module_courseId_idx" ON "Module"("courseId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleCompletion_moduleId_traineeId_key" ON "ModuleCompletion"("moduleId" ASC, "traineeId" ASC);

-- CreateIndex
CREATE INDEX "ModuleCompletion_traineeId_idx" ON "ModuleCompletion"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_recipientType_recipientId_idx" ON "NotificationLog"("recipientType" ASC, "recipientId" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_type_idx" ON "NotificationLog"("type" ASC);

-- CreateIndex
CREATE INDEX "Option_questionId_idx" ON "Option"("questionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PaystackEvent_paystackReference_eventType_key" ON "PaystackEvent"("paystackReference" ASC, "eventType" ASC);

-- CreateIndex
CREATE INDEX "PaystackEvent_paystackReference_idx" ON "PaystackEvent"("paystackReference" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceSummary_attemptId_key" ON "PerformanceSummary"("attemptId" ASC);

-- CreateIndex
CREATE INDEX "QaModerationAction_traineeId_idx" ON "QaModerationAction"("traineeId" ASC);

-- CreateIndex
CREATE INDEX "QaPost_threadId_idx" ON "QaPost"("threadId" ASC);

-- CreateIndex
CREATE INDEX "QaPostLike_postId_idx" ON "QaPostLike"("postId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "QaPostLike_postId_likerType_likerId_key" ON "QaPostLike"("postId" ASC, "likerType" ASC, "likerId" ASC);

-- CreateIndex
CREATE INDEX "QaThread_cohortId_idx" ON "QaThread"("cohortId" ASC);

-- CreateIndex
CREATE INDEX "QaThread_lessonId_idx" ON "QaThread"("lessonId" ASC);

-- CreateIndex
CREATE INDEX "Question_examId_idx" ON "Question"("examId" ASC);

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt" ASC);

-- CreateIndex
CREATE INDEX "SuspiciousEvent_attemptId_idx" ON "SuspiciousEvent"("attemptId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Testimonial_courseReviewId_key" ON "Testimonial"("courseReviewId" ASC);

-- CreateIndex
CREATE INDEX "Trainee_email_idx" ON "Trainee"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_email_key" ON "Trainee"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_publicProfileCode_key" ON "Trainee"("publicProfileCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_resetToken_key" ON "Trainee"("resetToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Trainee_verifyToken_key" ON "Trainee"("verifyToken" ASC);

-- CreateIndex
CREATE INDEX "UiStringTranslation_language_approved_idx" ON "UiStringTranslation"("language" ASC, "approved" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UiStringTranslation_sourceText_language_key" ON "UiStringTranslation"("sourceText" ASC, "language" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken" ASC);

-- CreateIndex
CREATE INDEX "UserNotification_createdAt_idx" ON "UserNotification"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "UserNotification_recipientType_recipientId_readAt_idx" ON "UserNotification"("recipientType" ASC, "recipientId" ASC, "readAt" ASC);

-- AddForeignKey
ALTER TABLE "AiCreditGrant" ADD CONSTRAINT "AiCreditGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCreditGrant" ADD CONSTRAINT "AiCreditGrant_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseExamAttemptId_fkey" FOREIGN KEY ("courseExamAttemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooldownOverride" ADD CONSTRAINT "CooldownOverride_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooldownOverride" ADD CONSTRAINT "CooldownOverride_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooldownOverride" ADD CONSTRAINT "CooldownOverride_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_enrolledById_fkey" FOREIGN KEY ("enrolledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrollment" ADD CONSTRAINT "CourseEnrollment_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseReview" ADD CONSTRAINT "CourseReview_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverableCertificate" ADD CONSTRAINT "DiscoverableCertificate_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverableCertificate" ADD CONSTRAINT "DiscoverableCertificate_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employer" ADD CONSTRAINT "Employer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentRecord" ADD CONSTRAINT "EnrollmentRecord_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentRecord" ADD CONSTRAINT "EnrollmentRecord_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedAttemptsAlert" ADD CONSTRAINT "FailedAttemptsAlert_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FailedAttemptsAlert" ADD CONSTRAINT "FailedAttemptsAlert_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InactivityAlert" ADD CONSTRAINT "InactivityAlert_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InactivityAlert" ADD CONSTRAINT "InactivityAlert_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntroductionDisclosedCertificate" ADD CONSTRAINT "IntroductionDisclosedCertificate_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntroductionDisclosedCertificate" ADD CONSTRAINT "IntroductionDisclosedCertificate_introductionRequestId_fkey" FOREIGN KEY ("introductionRequestId") REFERENCES "IntroductionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntroductionRequest" ADD CONSTRAINT "IntroductionRequest_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntroductionRequest" ADD CONSTRAINT "IntroductionRequest_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationDisclosedCertificate" ADD CONSTRAINT "JobApplicationDisclosedCertificate_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplicationDisclosedCertificate" ADD CONSTRAINT "JobApplicationDisclosedCertificate_jobApplicationId_fkey" FOREIGN KEY ("jobApplicationId") REFERENCES "JobApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialDownload" ADD CONSTRAINT "MaterialDownload_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialDownload" ADD CONSTRAINT "MaterialDownload_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCompletion" ADD CONSTRAINT "ModuleCompletion_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleCompletion" ADD CONSTRAINT "ModuleCompletion_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformanceSummary" ADD CONSTRAINT "PerformanceSummary_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaModerationAction" ADD CONSTRAINT "QaModerationAction_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaModerationAction" ADD CONSTRAINT "QaModerationAction_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaPost" ADD CONSTRAINT "QaPost_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "QaThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaPostLike" ADD CONSTRAINT "QaPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "QaPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaThread" ADD CONSTRAINT "QaThread_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaThread" ADD CONSTRAINT "QaThread_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QaThread" ADD CONSTRAINT "QaThread_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_generatedFromQuestionId_fkey" FOREIGN KEY ("generatedFromQuestionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuspiciousEvent" ADD CONSTRAINT "SuspiciousEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_courseReviewId_fkey" FOREIGN KEY ("courseReviewId") REFERENCES "CourseReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UiStringTranslation" ADD CONSTRAINT "UiStringTranslation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "registrationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TrainingOrganization" ADD COLUMN     "crmEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "state" TEXT,
    "relationships" TEXT[] DEFAULT ARRAY['PROSPECT']::TEXT[],
    "traineeId" TEXT,
    "assignedToId" TEXT,
    "firstSource" TEXT,
    "followUpEmail" BOOLEAN NOT NULL DEFAULT false,
    "followUpWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "optOutToken" TEXT NOT NULL,
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationAgreement" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseRegistration" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'REGISTERED',
    "motivation" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LINK',
    "sourceTag" TEXT,
    "growthPlayId" TEXT,
    "agreementId" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "signIpHash" TEXT,
    "signUserAgent" TEXT,
    "followUpEmail" BOOLEAN NOT NULL DEFAULT false,
    "followUpWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT,
    "followUpAt" TIMESTAMP(3),
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmConsent" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "noticeText" TEXT NOT NULL,
    "noticeVersion" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "registrationId" TEXT,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "registrationId" TEXT,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_optOutToken_key" ON "CrmContact"("optOutToken");

-- CreateIndex
CREATE INDEX "CrmContact_organizationId_createdAt_idx" ON "CrmContact"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmContact_traineeId_idx" ON "CrmContact"("traineeId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_ownerKey_email_key" ON "CrmContact"("ownerKey", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationAgreement_version_key" ON "RegistrationAgreement"("version");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_reference_key" ON "CourseRegistration"("reference");

-- CreateIndex
CREATE INDEX "CourseRegistration_organizationId_createdAt_idx" ON "CourseRegistration"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseRegistration_courseId_createdAt_idx" ON "CourseRegistration"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseRegistration_stage_idx" ON "CourseRegistration"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "CourseRegistration_courseId_contactId_key" ON "CourseRegistration"("courseId", "contactId");

-- CreateIndex
CREATE INDEX "CrmConsent_contactId_createdAt_idx" ON "CrmConsent"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmActivity_contactId_createdAt_idx" ON "CrmActivity"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmTask_organizationId_doneAt_dueAt_idx" ON "CrmTask"("organizationId", "doneAt", "dueAt");

-- CreateIndex
CREATE INDEX "CrmTask_assignedToId_doneAt_idx" ON "CrmTask"("assignedToId", "doneAt");

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseRegistration" ADD CONSTRAINT "CourseRegistration_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RegistrationAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmConsent" ADD CONSTRAINT "CrmConsent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starter agreement (version 1). A Super Admin edits it from the CRM settings page; every edit becomes a new version.
INSERT INTO "RegistrationAgreement" ("id", "version", "title", "body", "active", "createdAt")
VALUES (
  'agreement_v1_starter', 1, 'AAICBI Learner Agreement',
  E'1. What you confirm\nThe details you give in this registration are true and complete to the best of your knowledge.\n\n2. How you will take part\nYou will take part honestly. You will not share assessment answers, certificates or login details with anyone, and you will treat other learners and staff with respect.\n\n3. Being contacted\nIf you tick the follow-up box, AAICBI, Futybills Tech Community and the training organisation running this course may contact you by email and WhatsApp about this course: dates, how to join, reminders and next steps. You can ask us to stop at any time using the link in our messages.\n\n4. Your information\nWe use your information to manage your registration and to contact you about the course. We keep it safe, we do not sell it, and we handle it under our privacy notice and applicable data protection law, including the Nigeria Data Protection Act 2023. You can ask to see, correct or delete your information.\n\n5. Registration is not admission\nRegistering shows your interest. It does not guarantee a place. We will confirm your place, any fees and the start date in writing before the course begins.\n\n6. Signing\nTyping your full name and ticking the agreement box has the same effect as signing this agreement. We keep a record of the text you agreed to, the date and time, and the name you typed.',
  true, CURRENT_TIMESTAMP
)
ON CONFLICT ("version") DO NOTHING;

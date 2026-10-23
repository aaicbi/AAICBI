-- AlterTable
ALTER TABLE "CrmContact" ADD COLUMN     "emailSuppressedAt" TIMESTAMP(3),
ADD COLUMN     "emailSuppressedReason" TEXT;

-- CreateTable
CREATE TABLE "EmailSender" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "replyTo" TEXT,
    "stream" TEXT NOT NULL DEFAULT 'SERVICE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "allowOrganizations" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'SERVICE',
    "senderId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEmail" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "organizationId" TEXT,
    "contactId" TEXT NOT NULL,
    "registrationId" TEXT,
    "senderId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersion" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'SERVICE',
    "subjectRaw" TEXT NOT NULL,
    "bodyRaw" TEXT NOT NULL,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodyText" TEXT,
    "toEmail" TEXT NOT NULL,
    "fromHeader" TEXT,
    "replyTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "providerId" TEXT,
    "error" TEXT,
    "attachmentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmEmailEvent" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "providerEventId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmEmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSender_fromAddress_key" ON "EmailSender"("fromAddress");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_key_key" ON "EmailTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateVersion_templateId_version_key" ON "EmailTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CrmEmail_providerId_key" ON "CrmEmail"("providerId");

-- CreateIndex
CREATE INDEX "CrmEmail_contactId_createdAt_idx" ON "CrmEmail"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmEmail_status_scheduledFor_idx" ON "CrmEmail"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "CrmEmail_organizationId_createdAt_idx" ON "CrmEmail"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmEmailEvent_providerEventId_key" ON "CrmEmailEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "CrmEmailEvent_emailId_at_idx" ON "CrmEmailEvent"("emailId", "at");

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "EmailSender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmail" ADD CONSTRAINT "CrmEmail_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmail" ADD CONSTRAINT "CrmEmail_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "EmailSender"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmEmailEvent" ADD CONSTRAINT "CrmEmailEvent_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "CrmEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Starter senders. They are NOT verified and have no reply-to yet: a Super Admin confirms the domain in Resend and sets the reply-to address before anything can be sent.
INSERT INTO "EmailSender" ("id", "name", "fromAddress", "replyTo", "stream", "verified", "active", "allowOrganizations", "updatedAt")
VALUES
  ('sender_admissions', 'AAICBI Admissions', 'admissions@mail.aaicbi.org', NULL, 'SERVICE', false, true, true, CURRENT_TIMESTAMP),
  ('sender_hello', 'Futybills Tech Community', 'hello@mail.aaicbi.org', NULL, 'SERVICE', false, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("fromAddress") DO NOTHING;

-- Starter templates (version 1).
INSERT INTO "EmailTemplate" ("id", "key", "name", "description", "category", "subject", "body", "version", "active", "updatedAt") VALUES
  ('tpl_registration_received', 'registration_received', 'Registration received', 'Confirms a registration and says what happens next', 'SERVICE',
   $t$You're registered for {{course_name}}$t$,
   $t$<p>Hi {{first_name}},</p><p>Thank you for registering for <strong>{{course_name}}</strong>. Your reference is <strong>{{application_reference}}</strong>.</p><p>We will share the start date and how to join. If you have questions, just reply to this email.</p><p>Warm regards,<br>{{assigned_staff_name}}</p>$t$, 1, true, CURRENT_TIMESTAMP),
  ('tpl_missing_information', 'missing_information', 'Missing information', 'Asks for a missing detail', 'SERVICE',
   $t$A question about your registration for {{course_name}}$t$,
   $t$<p>Hi {{first_name}},</p><p>Thank you for registering for <strong>{{course_name}}</strong> (reference {{application_reference}}). We need one more detail from you:</p><p>[Write what you need here]</p><p>Please reply to this email with it, and we will take it from there.</p><p>Warm regards,<br>{{assigned_staff_name}}</p>$t$, 1, true, CURRENT_TIMESTAMP),
  ('tpl_course_starts_soon', 'course_starts_soon', 'Course starts soon', 'Reminder before the start date', 'SERVICE',
   $t${{course_name}} starts on {{course_start_date}}$t$,
   $t$<p>Hi {{first_name}},</p><p><strong>{{course_name}}</strong> starts on <strong>{{course_start_date}}</strong>. Here is what to do before then:</p><ul><li>Make sure you can sign in to your AAICBI account.</li><li>Have a phone or computer with internet ready.</li><li>Reply to this email if anything is stopping you from joining.</li></ul><p>We look forward to learning with you.</p><p>Warm regards,<br>{{assigned_staff_name}}</p>$t$, 1, true, CURRENT_TIMESTAMP),
  ('tpl_welcome_next_steps', 'welcome_next_steps', 'Welcome and next steps', 'Welcomes someone and explains how to begin', 'SERVICE',
   $t$Welcome to {{course_name}}$t$,
   $t$<p>Hi {{full_name}},</p><p>Welcome to <strong>{{course_name}}</strong>. We are glad you are here.</p><p>To begin:</p><ol><li>Create your free AAICBI account, or sign in if you have one.</li><li>Open the course and start Module 1.</li><li>Reply to this email whenever you need help.</li></ol><p>Warm regards,<br>{{assigned_staff_name}}<br>{{organisation_name}}</p>$t$, 1, true, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "EmailTemplateVersion" ("id", "templateId", "version", "subject", "body")
SELECT 'tplv_' || "key" || '_1', "id", 1, "subject", "body" FROM "EmailTemplate" WHERE "version" = 1
ON CONFLICT ("templateId", "version") DO NOTHING;

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'COHORT');

-- AlterTable: messaging suspension, mirrors Trainee.qaSuspendedAt as its
-- own parallel column (see that field's schema comment for why).
ALTER TABLE "Trainee" ADD COLUMN "messagingSuspendedAt" TIMESTAMP(3);

-- AlterTable: optional chat-context columns for a report that
-- originates from a conversation, plus STAFF as a valid reportedType
-- value (no DB change needed for that — reportedType is already TEXT).
ALTER TABLE "ProfileReport" ADD COLUMN "contextType" TEXT;
ALTER TABLE "ProfileReport" ADD COLUMN "contextId" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL,
    "cohortId" TEXT,
    "pairKey" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "participantType" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "blockerType" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedType" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagingModerationAction" (
    "id" TEXT NOT NULL,
    "traineeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "issuedById" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_cohortId_key" ON "Conversation"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_pairKey_key" ON "Conversation"("pairKey");

-- CreateIndex
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");

-- CreateIndex
CREATE INDEX "Conversation_lastMessageAt_idx" ON "Conversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_participantType_pa_key" ON "ConversationParticipant"("conversationId", "participantType", "participantId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_participantType_participantId_idx" ON "ConversationParticipant"("participantType", "participantId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Block_blockerType_blockerId_blockedType_blockedId_key" ON "Block"("blockerType", "blockerId", "blockedType", "blockedId");

-- CreateIndex
CREATE INDEX "Block_blockedType_blockedId_idx" ON "Block"("blockedType", "blockedId");

-- CreateIndex
CREATE INDEX "MessagingModerationAction_traineeId_idx" ON "MessagingModerationAction"("traineeId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingModerationAction" ADD CONSTRAINT "MessagingModerationAction_traineeId_fkey" FOREIGN KEY ("traineeId") REFERENCES "Trainee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingModerationAction" ADD CONSTRAINT "MessagingModerationAction_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

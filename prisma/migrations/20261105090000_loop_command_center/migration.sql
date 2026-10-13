-- CreateEnum
CREATE TYPE "LoopActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'REJECTED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "loopLevel" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "LoopConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoopConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoopMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "context" TEXT,
    "attachments" JSONB,
    "toolEvents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoopMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoopPendingAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "status" "LoopActionStatus" NOT NULL DEFAULT 'PENDING',
    "autoExecuted" BOOLEAN NOT NULL DEFAULT false,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LoopPendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoopConversation_userId_updatedAt_idx" ON "LoopConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "LoopMessage_conversationId_createdAt_idx" ON "LoopMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "LoopPendingAction_conversationId_createdAt_idx" ON "LoopPendingAction"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "LoopPendingAction_userId_status_idx" ON "LoopPendingAction"("userId", "status");

-- AddForeignKey
ALTER TABLE "LoopConversation" ADD CONSTRAINT "LoopConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopMessage" ADD CONSTRAINT "LoopMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "LoopConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopPendingAction" ADD CONSTRAINT "LoopPendingAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "LoopConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopPendingAction" ADD CONSTRAINT "LoopPendingAction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "LoopMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoopPendingAction" ADD CONSTRAINT "LoopPendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


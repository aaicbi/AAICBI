-- CreateEnum
CREATE TYPE "LoopBroadcastStatus" AS ENUM ('SENT', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "UserNotification" ADD COLUMN     "senderLabel" TEXT;

-- CreateTable
CREATE TABLE "LoopBroadcast" (
    "id" TEXT NOT NULL,
    "authorizedById" TEXT NOT NULL,
    "senderLabel" TEXT NOT NULL DEFAULT 'Loop — Systems Manager',
    "recipientDescription" TEXT NOT NULL,
    "recipientFilter" JSONB NOT NULL,
    "recipientCountExpected" INTEGER NOT NULL,
    "recipientCountActual" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "LoopBroadcastStatus" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoopBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoopBroadcast_authorizedById_idx" ON "LoopBroadcast"("authorizedById");

-- CreateIndex
CREATE INDEX "LoopBroadcast_sentAt_idx" ON "LoopBroadcast"("sentAt");

-- AddForeignKey
ALTER TABLE "LoopBroadcast" ADD CONSTRAINT "LoopBroadcast_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SuperAdminMessage" (
    "id" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "readById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuperAdminMessage_readAt_idx" ON "SuperAdminMessage"("readAt");

-- CreateIndex
CREATE INDEX "SuperAdminMessage_createdAt_idx" ON "SuperAdminMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "SuperAdminMessage" ADD CONSTRAINT "SuperAdminMessage_readById_fkey" FOREIGN KEY ("readById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

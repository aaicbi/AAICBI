-- CreateTable
CREATE TABLE "AiCommandLog" (
    "id" TEXT NOT NULL,
    "askedById" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCommandLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCommandLog_askedById_idx" ON "AiCommandLog"("askedById");

-- CreateIndex
CREATE INDEX "AiCommandLog_createdAt_idx" ON "AiCommandLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AiCommandLog" ADD CONSTRAINT "AiCommandLog_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

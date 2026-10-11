-- CreateTable
CREATE TABLE "StaffSignInLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "StaffSignInLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffSignInLog_at_idx" ON "StaffSignInLog"("at");

-- CreateIndex
CREATE INDEX "StaffSignInLog_email_at_idx" ON "StaffSignInLog"("email", "at");

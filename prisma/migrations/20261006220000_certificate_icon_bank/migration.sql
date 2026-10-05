-- CreateTable
CREATE TABLE "CertificateIcon" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateIcon_pkey" PRIMARY KEY ("id")
);

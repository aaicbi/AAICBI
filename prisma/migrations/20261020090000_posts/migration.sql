-- One content model for text, image galleries and YouTube videos, with review history.
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'CHANGES_REQUESTED', 'PUBLISHED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "PostType" AS ENUM ('TEXT', 'IMAGE', 'YOUTUBE');
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC', 'MEMBERS');

CREATE TABLE "Post" (
  "id" TEXT NOT NULL,
  "type" "PostType" NOT NULL DEFAULT 'TEXT',
  "authorProfileId" TEXT NOT NULL,
  "actingAsProfileId" TEXT,
  "title" TEXT,
  "body" TEXT NOT NULL DEFAULT '',
  "youtubeId" TEXT,
  "youtubeUrl" TEXT,
  "tags" TEXT[],
  "visibility" "PostVisibility" NOT NULL DEFAULT 'PUBLIC',
  "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "reviewNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "orgBlockedAt" TIMESTAMP(3),
  "orgBlockedById" TEXT,
  "orgBlockReason" TEXT,
  "legacyEducationPostId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Post_legacyEducationPostId_key" ON "Post"("legacyEducationPostId");
CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");
CREATE INDEX "Post_authorProfileId_status_idx" ON "Post"("authorProfileId", "status");
CREATE INDEX "Post_actingAsProfileId_status_idx" ON "Post"("actingAsProfileId", "status");

CREATE TABLE "PostMedia" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "alt" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PostMedia_postId_order_idx" ON "PostMedia"("postId", "order");
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PostReview" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PostReview_postId_createdAt_idx" ON "PostReview"("postId", "createdAt");
ALTER TABLE "PostReview" ADD CONSTRAINT "PostReview_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

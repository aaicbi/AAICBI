-- Interactions: reactions, comments, follows, bookmarks and reports; a topic index for posts.
CREATE TYPE "PostReactionKind" AS ENUM ('LIKE', 'INSIGHTFUL', 'CELEBRATE');

CREATE TABLE "PostReaction" (
  "postId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "kind" "PostReactionKind" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostReaction_pkey" PRIMARY KEY ("postId", "profileId")
);
CREATE INDEX "PostReaction_postId_kind_idx" ON "PostReaction"("postId", "kind");
CREATE INDEX "PostReaction_profileId_createdAt_idx" ON "PostReaction"("profileId", "createdAt");

CREATE TABLE "PostComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "authorProfileId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'VISIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");
CREATE INDEX "PostComment_parentId_idx" ON "PostComment"("parentId");
CREATE INDEX "PostComment_authorProfileId_createdAt_idx" ON "PostComment"("authorProfileId", "createdAt");

CREATE TABLE "Follow" (
  "followerProfileId" TEXT NOT NULL,
  "followedProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerProfileId", "followedProfileId")
);
CREATE INDEX "Follow_followedProfileId_createdAt_idx" ON "Follow"("followedProfileId", "createdAt");

CREATE TABLE "Bookmark" (
  "profileId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("profileId", "postId")
);
CREATE INDEX "Bookmark_profileId_createdAt_idx" ON "Bookmark"("profileId", "createdAt");

CREATE TABLE "PostReport" (
  "id" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "commentId" TEXT,
  "reporterProfileId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "escalatedById" TEXT,
  "escalationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PostReport_targetKind_postId_commentId_reporterProfileId_key" ON "PostReport"("targetKind", "postId", "commentId", "reporterProfileId");
CREATE INDEX "PostReport_status_createdAt_idx" ON "PostReport"("status", "createdAt");

CREATE INDEX "Post_tags_idx" ON "Post" USING GIN ("tags");

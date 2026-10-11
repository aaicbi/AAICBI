-- Posts copied from Community Showcase projects keep a link to their project (one post per project).
ALTER TABLE "Post" ADD COLUMN "legacyProjectId" TEXT;
CREATE UNIQUE INDEX "Post_legacyProjectId_key" ON "Post"("legacyProjectId");

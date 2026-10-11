import type { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/profiles/profiles";

/**
 * Copies the earlier educational videos (EducationPost) into the unified post
 * model. The originals are left exactly as they are. Safe to run again: a
 * video already copied is skipped (`legacyEducationPostId`). Only videos in
 * a settled state are copied: published, waiting for central review, declined,
 * or removed. Earlier consent and organization-review steps have no equivalent
 * in the new flow and stay with the original record. Demo videos are not copied.
 */
const STATUS: Record<string, PostStatus> = { PUBLISHED: "PUBLISHED", PENDING_REVIEW: "PENDING_REVIEW", REJECTED: "REJECTED", DECLINED: "REJECTED", REMOVED: "SUSPENDED" };

export async function backfillPostsFromEducation(): Promise<{ copied: number; skipped: number; total: number }> {
  const rows = await prisma.educationPost.findMany({ where: { isDemo: false, status: { in: ["PUBLISHED", "PENDING_REVIEW", "REJECTED", "DECLINED", "REMOVED"] } }, orderBy: { createdAt: "asc" } });
  const have = new Set((await prisma.post.findMany({ where: { legacyEducationPostId: { not: null } }, select: { legacyEducationPostId: true } })).map((p) => p.legacyEducationPostId));
  let copied = 0;
  for (const r of rows) {
    if (have.has(r.id)) continue;
    const [person, org] = await Promise.all([ensureProfile("PERSON", r.traineeId), ensureProfile("TRAINING_ORG", r.trainingOrganizationId)]);
    if (!person) continue;
    const post = await prisma.post.create({
      data: {
        type: "YOUTUBE",
        authorProfileId: person.id,
        actingAsProfileId: org?.id ?? null,
        title: r.title,
        body: r.description ?? "",
        youtubeId: r.youtubeId,
        youtubeUrl: r.youtubeUrl,
        tags: [],
        status: STATUS[r.status],
        reviewNote: r.reviewNote,
        submittedAt: r.createdAt,
        publishedAt: STATUS[r.status] === "PUBLISHED" ? r.publishedAt ?? r.createdAt : null,
        legacyEducationPostId: r.id,
        createdAt: r.createdAt,
      },
    });
    await prisma.postReview.create({ data: { postId: post.id, action: "MIGRATED", note: `Copied from the earlier video flow (${r.status}).` } });
    copied++;
  }
  return { copied, skipped: rows.length - copied, total: rows.length };
}

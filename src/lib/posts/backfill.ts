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

export async function backfillPostsFromEducation(): Promise<{ copied: number; skipped: number; total: number; updated: number }> {
  const rows = await prisma.educationPost.findMany({ where: { isDemo: false, status: { in: ["PUBLISHED", "PENDING_REVIEW", "REJECTED", "DECLINED", "REMOVED"] } }, orderBy: { createdAt: "asc" } });
  const mirrored = await prisma.post.findMany({ where: { legacyEducationPostId: { not: null } }, select: { id: true, legacyEducationPostId: true, status: true } });
  const have = new Map(mirrored.map((p) => [p.legacyEducationPostId!, p]));
  let copied = 0;
  let updated = 0;
  for (const r of rows) {
    const existing = have.get(r.id);
    if (existing) {
      // The earlier flow decided something since the copy (published, declined, removed): the copy follows it.
      // A reviewer's decision made in the new inbox wins, so a copy already published or taken down there is left alone.
      const wanted = STATUS[r.status];
      if (existing.status === "PENDING_REVIEW" && wanted !== existing.status) {
        await prisma.post.update({ where: { id: existing.id }, data: { status: wanted, publishedAt: wanted === "PUBLISHED" ? r.publishedAt ?? new Date() : null, reviewNote: r.reviewNote } });
        updated++;
      }
      continue;
    }
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
  return { copied, skipped: rows.length - copied - updated, total: rows.length, updated };
}

let lastSync = 0;
/**
 * Keeps the copies of earlier videos up to date while the earlier flow is still
 * in use: at most once a minute per server, and never allowed to fail the page.
 */
export async function syncEducationPosts(): Promise<void> {
  if (Date.now() - lastSync < 60_000) return;
  lastSync = Date.now();
  try {
    await backfillPostsFromEducation();
  } catch (e) {
    console.error("Could not sync earlier videos:", e instanceof Error ? e.message : e);
  }
}

/** Copies the earlier organization follows into the follow graph the feed and profiles use. Safe to run again. */
export async function backfillFollows(): Promise<{ copied: number; total: number }> {
  const rows = await prisma.organizationFollow.findMany({ select: { traineeId: true, trainingOrganizationId: true, createdAt: true } });
  let copied = 0;
  for (const r of rows) {
    const [me, org] = await Promise.all([ensureProfile("PERSON", r.traineeId), ensureProfile("TRAINING_ORG", r.trainingOrganizationId)]);
    if (!me || !org) continue;
    const res = await prisma.follow.createMany({ data: [{ followerProfileId: me.id, followedProfileId: org.id, createdAt: r.createdAt }], skipDuplicates: true });
    copied += res.count;
  }
  return { copied, total: rows.length };
}

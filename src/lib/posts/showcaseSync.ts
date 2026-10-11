import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/profiles/profiles";
import { parseYouTubeUrl } from "@/lib/ecosystem/youtube";
import { autoReviewEnabled, review } from "@/lib/posts/autoReview";
import { extractTags, LIMITS } from "@/lib/posts/postCore";
import { publicFeedChanged } from "@/lib/posts/feedCache";

/**
 * Everything shown in the Community Showcase is also a post in the feed. An approved showcase project becomes a
 * published post (one per project, by the trainee who made it); a project taken out of the showcase takes its post
 * down with it, and brings it back if the project is approved again. Safe to run again.
 */

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The automatic reviewer reads a project put forward for the showcase: a clean one is approved at once, anything else waits for a person. */
export async function autoReviewShowcaseProject(projectId: string): Promise<boolean> {
  if (!autoReviewEnabled()) return false;
  const p = await prisma.project.findUnique({ where: { id: projectId }, include: { media: { select: { id: true }, take: 1 } } });
  if (!p || !p.listedInShowcase || p.showcaseStatus !== "PENDING_REVIEW") return false;
  const verdict = review({ title: p.title, body: [p.description, p.url].filter(Boolean).join("\n"), trusted: false, hasMedia: p.media.length > 0 });
  if (!verdict.publish) return false;
  const res = await prisma.project.updateMany({ where: { id: projectId, showcaseStatus: "PENDING_REVIEW" }, data: { showcaseStatus: "APPROVED", reviewedAt: new Date(), reviewedById: null } });
  return res.count > 0;
}

export async function syncShowcasePosts(): Promise<{ created: number; hidden: number; restored: number }> {
  const mirrors = await prisma.post.findMany({ where: { legacyProjectId: { not: null } }, select: { id: true, legacyProjectId: true, status: true } });
  const live = await prisma.project.findMany({
    where: { listedInShowcase: true, showcaseStatus: "APPROVED" },
    include: { media: { orderBy: { order: "asc" } }, trainee: { select: { id: true } } },
    orderBy: { id: "asc" },
  });
  const liveIds = new Set(live.map((p) => p.id));
  const have = new Map(mirrors.map((m) => [m.legacyProjectId!, m]));
  let created = 0, hidden = 0, restored = 0;

  for (const p of live) {
    const existing = have.get(p.id);
    if (existing) {
      if (existing.status === "SUSPENDED") {
        const last = await prisma.postReview.findFirst({ where: { postId: existing.id }, orderBy: { createdAt: "desc" }, select: { action: true } });
        if (last?.action === "SHOWCASE_HIDDEN") {
          await prisma.post.update({ where: { id: existing.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
          await prisma.postReview.create({ data: { postId: existing.id, action: "REINSTATED", actorName: "Showcase", note: "The project is in the showcase again." } });
          restored++;
        }
      }
      continue;
    }
    const person = await ensureProfile("PERSON", p.trainee.id);
    if (!person) continue;
    const images = p.media.filter((m) => m.type === "IMAGE" && /^https:\/\//i.test(m.url)).slice(0, LIMITS.images);
    const video = images.length === 0 ? p.media.filter((m) => m.type === "VIDEO").map((m) => parseYouTubeUrl(m.url)).find(Boolean) ?? null : null;
    const body = clip([p.description, p.url].filter(Boolean).join("\n\n"), LIMITS.body);
    const post = await prisma.post.create({
      data: {
        type: video ? "YOUTUBE" : images.length > 0 ? "IMAGE" : "TEXT",
        authorProfileId: person.id, title: clip(p.title, LIMITS.title), body, tags: extractTags(`${body} #showcase`),
        youtubeId: video?.id ?? null, youtubeUrl: video?.watchUrl ?? null,
        status: "PUBLISHED", submittedAt: p.reviewedAt ?? new Date(), publishedAt: p.reviewedAt ?? new Date(), legacyProjectId: p.id,
        media: { create: images.map((m, order) => ({ url: m.url, alt: null, order })) },
      },
    });
    await prisma.postReview.create({ data: { postId: post.id, action: "MIGRATED", actorName: "Showcase", note: "Copied from the Community Showcase." } });
    created++;
  }
  for (const m of mirrors) {
    if (!liveIds.has(m.legacyProjectId!) && m.status === "PUBLISHED") {
      await prisma.post.update({ where: { id: m.id }, data: { status: "SUSPENDED" } });
      await prisma.postReview.create({ data: { postId: m.id, action: "SHOWCASE_HIDDEN", actorName: "Showcase", note: "The project is no longer in the showcase." } });
      hidden++;
    }
  }
  if (created + hidden + restored > 0) publicFeedChanged();
  return { created, hidden, restored };
}

let lastSync = 0;
/** At most once a minute per server, and never allowed to fail the page. */
export async function syncShowcaseLazily(): Promise<void> {
  if (Date.now() - lastSync < 60_000) return;
  lastSync = Date.now();
  try { await syncShowcasePosts(); } catch (e) { console.error("Could not sync the showcase:", e instanceof Error ? e.message : e); }
}

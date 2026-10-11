import type { Post, PostStatus, Prisma, Profile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import type { SessionPayload } from "@/lib/auth/session";
import { notifyByEmail } from "@/lib/notifications/log";
import { simpleNoticeEmail } from "@/lib/notifications/templates";
import { parseYouTubeUrl } from "@/lib/ecosystem/youtube";
import { ensureProfile } from "@/lib/profiles/profiles";
import { recipientOf } from "@/lib/profiles/handleChanges";
import { cardsFor, type ProfileCard } from "@/lib/profiles/card";
import { loadProfileView } from "@/lib/profiles/view";
import { can } from "@/lib/startups/startupCore";
import { PostInput, REVIEW_LOG_ACTION, canEdit, canSubmit, canWithdraw, extractTags, isMaterialEdit, isPubliclyVisible, needsReview, nextStatus, statusAfterEdit, typeOf, type ReviewAction } from "@/lib/posts/postCore";

/**
 * Posts: one model for text, image galleries and YouTube videos. Everything
 * a person publishes passes review before the public can see it, except a
 * super admin's own posts. A material edit to a published post goes back to
 * review. The one visibility rule is `isPubliclyVisible` in postCore.
 */
export class PostError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const MAX_NEW_PER_DAY = 30;

export interface Identity {
  key: string;
  label: string;
  kind: "self" | "startup" | "organization";
  authorProfileId: string;
  actingAsProfileId: string | null;
  /** True for a super admin posting as themselves: no review step. */
  skipsReview: boolean;
}

/** Everything a signed-in person may post as. The first one is "yourself" (or your organization). */
export async function identitiesOf(session: SessionPayload): Promise<Identity[]> {
  const out: Identity[] = [];
  if (session.role === "TRAINEE") {
    const me = await ensureProfile("PERSON", session.userId);
    if (!me) return [];
    out.push({ key: "self", label: "Yourself", kind: "self", authorProfileId: me.id, actingAsProfileId: null, skipsReview: false });
    const teams = await prisma.startupMember.findMany({ where: { traineeId: session.userId, status: "ACTIVE" }, include: { startup: { select: { id: true, name: true, status: true } } } });
    for (const m of teams) {
      if (m.startup.status !== "APPROVED" || !can(m, "publish")) continue;
      const sp = await ensureProfile("STARTUP", m.startup.id);
      if (sp) out.push({ key: `startup:${m.startup.id}`, label: `${m.startup.name} (startup)`, kind: "startup", authorProfileId: me.id, actingAsProfileId: sp.id, skipsReview: false });
    }
  } else if (session.role === "EMPLOYER") {
    const e = await prisma.employer.findUnique({ where: { id: session.userId }, select: { approvalState: true } });
    const p = e?.approvalState === "APPROVED" ? await ensureProfile("EMPLOYER", session.userId) : null;
    if (p) out.push({ key: "self", label: "Your company", kind: "self", authorProfileId: p.id, actingAsProfileId: null, skipsReview: false });
  } else if (session.role === "INVESTOR") {
    const i = await prisma.investor.findUnique({ where: { id: session.userId }, select: { approvalState: true } });
    const p = i?.approvalState === "APPROVED" ? await ensureProfile("INVESTOR", session.userId) : null;
    if (p) out.push({ key: "self", label: "Yourself", kind: "self", authorProfileId: p.id, actingAsProfileId: null, skipsReview: false });
  } else if (session.role === "SUPER_ADMIN" || session.role === "ADMIN" || session.role === "INSTRUCTOR") {
    const org = await prisma.trainingOrganization.findFirst({ where: { staffUserId: session.userId, approvalState: "APPROVED" }, select: { id: true, name: true } });
    if (org) {
      // A training organization's team posts as the organization itself.
      const op = await ensureProfile("TRAINING_ORG", org.id);
      if (op) out.push({ key: "organization", label: `${org.name} (organization)`, kind: "organization", authorProfileId: op.id, actingAsProfileId: null, skipsReview: false });
    } else {
      const sp = await ensureProfile("STAFF", session.userId);
      if (sp) out.push({ key: "self", label: "Yourself", kind: "self", authorProfileId: sp.id, actingAsProfileId: null, skipsReview: session.role === "SUPER_ADMIN" });
    }
  }
  return out;
}

/** Every profile this person may edit posts for (their own author profiles and the startups or organization they publish for). */
async function profileIdsOf(session: SessionPayload): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const i of await identitiesOf(session)) {
    ids.add(i.authorProfileId);
    if (i.actingAsProfileId) ids.add(i.actingAsProfileId);
  }
  return ids;
}

async function requireManage(session: SessionPayload, postId: string): Promise<Post> {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new PostError("Post not found.", 404);
  const mine = await profileIdsOf(session);
  if (!mine.has(post.authorProfileId) && !(post.actingAsProfileId && mine.has(post.actingAsProfileId))) throw new PostError("That is not your post.", 403);
  return post;
}

function parseVideo(url: string | null): { id: string; watchUrl: string } | null {
  if (!url) return null;
  const y = parseYouTubeUrl(url);
  if (!y) throw new PostError("That does not look like a YouTube link. Paste the link to a YouTube video.", 400);
  return { id: y.id, watchUrl: y.watchUrl };
}

async function log(postId: string, action: string, actor: { userId?: string; name?: string } | null, note?: string | null) {
  await prisma.postReview.create({ data: { postId, action, actorId: actor?.userId ?? null, actorName: actor?.name ?? null, note: note ?? null } });
}

async function nameOf(session: SessionPayload): Promise<string> {
  if (session.role === "TRAINEE") return (await prisma.trainee.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? "Member";
  if (session.role === "EMPLOYER") return (await prisma.employer.findUnique({ where: { id: session.userId }, select: { companyName: true } }))?.companyName ?? "Employer";
  if (session.role === "INVESTOR") return (await prisma.investor.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? "Investor";
  return (await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name ?? "Staff";
}

export async function createPost(session: SessionPayload, identityKey: string, input: PostInput, submit: boolean): Promise<Post> {
  const identity = (await identitiesOf(session)).find((i) => i.key === identityKey);
  if (!identity) throw new PostError("You cannot post as that.", 403);
  const recent = await prisma.post.count({ where: { authorProfileId: identity.authorProfileId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  if (recent >= MAX_NEW_PER_DAY) throw new PostError("You have written a lot of posts today. Please try again tomorrow.", 429);
  const video = parseVideo(input.youtubeUrl);
  const publishNow = submit && !needsReview({ isSuperAdmin: identity.skipsReview });
  const post = await prisma.post.create({
    data: {
      type: typeOf({ youtubeUrl: video?.watchUrl ?? null, images: input.images }),
      authorProfileId: identity.authorProfileId,
      actingAsProfileId: identity.actingAsProfileId,
      title: input.title,
      body: input.body,
      youtubeId: video?.id ?? null,
      youtubeUrl: video?.watchUrl ?? null,
      tags: extractTags(input.body),
      visibility: input.visibility,
      status: submit ? (publishNow ? "PUBLISHED" : "PENDING_REVIEW") : "DRAFT",
      submittedAt: submit ? new Date() : null,
      publishedAt: publishNow ? new Date() : null,
      media: { create: input.images.map((m, order) => ({ url: m.url, alt: m.alt, order })) },
    },
  });
  if (submit) await afterSubmit(post, session, publishNow);
  return post;
}

async function afterSubmit(post: Post, session: SessionPayload, publishedDirectly: boolean) {
  const name = await nameOf(session);
  await log(post.id, publishedDirectly ? "APPROVED" : "SUBMITTED", { userId: session.userId, name }, publishedDirectly ? "Published directly by a super admin." : null);
  if (publishedDirectly) return;
  try {
    const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN", active: true, trainingOrgAsStaffUser: null }, select: { id: true, email: true } });
    const content = simpleNoticeEmail({ subject: "A post is waiting for review", paragraphs: [`${name} sent a post for review.`], buttonLabel: "Open the post", url: appUrl(`/post/${post.id}`) });
    for (const a of admins) await notifyByEmail({ recipientType: "STAFF", recipientId: a.id, to: a.email, type: "POST_SUBMITTED", relatedId: post.id, url: `/post/${post.id}`, ...content });
  } catch (e) {
    console.error("Could not notify reviewers of a post:", e instanceof Error ? e.message : e);
  }
}

export async function updatePost(session: SessionPayload, postId: string, input: PostInput): Promise<Post> {
  const post = await requireManage(session, postId);
  if (!canEdit(post.status)) throw new PostError("This post cannot be edited right now.", 409);
  const video = parseVideo(input.youtubeUrl);
  const before = await prisma.postMedia.findMany({ where: { postId }, orderBy: { order: "asc" }, select: { url: true } });
  const material = isMaterialEdit({ title: post.title, body: post.body, youtubeId: post.youtubeId, images: before.map((m) => m.url) }, { title: input.title, body: input.body, youtubeId: video?.id ?? null, images: input.images.map((m) => m.url) });
  const identity = (await identitiesOf(session)).find((i) => i.authorProfileId === post.authorProfileId);
  const skips = !!identity?.skipsReview;
  const status = statusAfterEdit(post.status, material, skips);
  const goingBack = status === "PENDING_REVIEW" && post.status === "PUBLISHED";
  const updated = await prisma.$transaction(async (tx) => {
    await tx.postMedia.deleteMany({ where: { postId } });
    return tx.post.update({
      where: { id: postId },
      data: {
        type: typeOf({ youtubeUrl: video?.watchUrl ?? null, images: input.images }),
        title: input.title, body: input.body, youtubeId: video?.id ?? null, youtubeUrl: video?.watchUrl ?? null, tags: extractTags(input.body), visibility: input.visibility,
        status,
        revision: material && post.status !== "DRAFT" ? { increment: 1 } : undefined,
        submittedAt: goingBack ? new Date() : undefined,
        media: { create: input.images.map((m, order) => ({ url: m.url, alt: m.alt, order })) },
      },
    });
  });
  if (material && post.status === "PUBLISHED") await log(postId, "EDITED", { userId: session.userId, name: await nameOf(session) }, goingBack ? "Edited after publishing; sent back for review." : "Edited by a super admin.");
  return updated;
}

export async function submitPost(session: SessionPayload, postId: string): Promise<Post> {
  const post = await requireManage(session, postId);
  if (!canSubmit(post.status)) throw new PostError("This post is already with a reviewer or has been decided.", 409);
  const identity = (await identitiesOf(session)).find((i) => i.authorProfileId === post.authorProfileId);
  const publishNow = !needsReview({ isSuperAdmin: !!identity?.skipsReview });
  const updated = await prisma.post.update({ where: { id: postId }, data: { status: publishNow ? "PUBLISHED" : "PENDING_REVIEW", submittedAt: new Date(), publishedAt: publishNow ? post.publishedAt ?? new Date() : null, reviewNote: null } });
  await afterSubmit(updated, session, publishNow);
  return updated;
}

export async function withdrawPost(session: SessionPayload, postId: string): Promise<void> {
  const post = await requireManage(session, postId);
  if (!canWithdraw(post.status)) throw new PostError("Only a post waiting for review can be taken back.", 409);
  await prisma.post.update({ where: { id: postId }, data: { status: "DRAFT" } });
  await log(postId, "WITHDRAWN", { userId: session.userId, name: await nameOf(session) });
}

export async function deletePost(session: SessionPayload, postId: string): Promise<void> {
  await requireManage(session, postId);
  await prisma.post.delete({ where: { id: postId } });
}

/** A reviewer's decision. Changes the status, records who and why, and tells the author. */
export async function reviewPost(postId: string, action: ReviewAction, note: string | null, actor: { userId: string; name: string }): Promise<Post> {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new PostError("Post not found.", 404);
  const next = nextStatus(post.status as PostStatus, action, note);
  if (!next.ok) throw new PostError(next.error, next.code === "reason" ? 400 : 409);
  const claimed = await prisma.post.updateMany({
    where: { id: postId, status: post.status },
    data: { status: next.status, reviewNote: action === "approve" || action === "reinstate" ? null : note?.trim() ?? null, publishedAt: next.status === "PUBLISHED" ? post.publishedAt ?? new Date() : undefined },
  });
  if (claimed.count === 0) throw new PostError("Someone else just decided this post.", 409);
  await log(postId, REVIEW_LOG_ACTION[action], actor, note?.trim() || null);
  try {
    const author = await prisma.profile.findUnique({ where: { id: post.authorProfileId } });
    const who = author ? await recipientOf(author) : null;
    if (who) {
      const verbs: Record<ReviewAction, string> = { approve: "was approved and is now published", request_changes: "needs some changes before it can be published", reject: "was not approved", suspend: "was taken down", reinstate: "is published again" };
      const content = simpleNoticeEmail({ subject: `Your post ${verbs[action]}`, paragraphs: [`Your post ${verbs[action]}.`, ...(note ? [`Reviewer's note: ${note}`] : [])], buttonLabel: "Open your post", url: appUrl(`/post/${postId}`) });
      await notifyByEmail({ recipientType: who.recipientType, recipientId: who.recipientId, to: who.to, type: "POST_DECIDED", relatedId: postId, url: `/post/${postId}`, ...content });
    }
  } catch (e) {
    console.error("Could not notify a post author:", e instanceof Error ? e.message : e);
  }
  return (await prisma.post.findUnique({ where: { id: postId } }))!;
}

export interface PostView {
  id: string;
  type: Post["type"];
  title: string | null;
  body: string;
  tags: string[];
  youtubeId: string | null;
  youtubeUrl: string | null;
  images: Array<{ url: string; alt: string | null }>;
  visibility: Post["visibility"];
  status: PostStatus;
  reviewNote: string | null;
  orgBlockedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  author: ProfileCard & { linkable: boolean };
  actingAs: (ProfileCard & { linkable: boolean }) | null;
}

async function toViews(posts: Array<Post & { media: Array<{ url: string; alt: string | null; order: number }> }>, viewer: SessionPayload | null): Promise<PostView[]> {
  const profileIds = [...new Set(posts.flatMap((p) => [p.authorProfileId, p.actingAsProfileId]).filter((x): x is string => !!x))];
  const profiles = await prisma.profile.findMany({ where: { id: { in: profileIds } } });
  const cards = await cardsFor(profiles);
  const linkable = new Map<string, boolean>();
  for (const p of profiles) linkable.set(p.id, !!(await loadProfileView(p, viewer)));
  const withLink = (id: string): (ProfileCard & { linkable: boolean }) => ({ ...cards.get(id)!, linkable: linkable.get(id) ?? false });
  return posts.map((p) => ({
    id: p.id, type: p.type, title: p.title, body: p.body, tags: p.tags, youtubeId: p.youtubeId, youtubeUrl: p.youtubeUrl,
    images: [...p.media].sort((a, b) => a.order - b.order).map((m) => ({ url: m.url, alt: m.alt })),
    visibility: p.visibility, status: p.status, reviewNote: p.reviewNote, orgBlockedAt: p.orgBlockedAt?.toISOString() ?? null,
    publishedAt: p.publishedAt?.toISOString() ?? null, createdAt: p.createdAt.toISOString(),
    author: withLink(p.authorProfileId),
    actingAs: p.actingAsProfileId ? withLink(p.actingAsProfileId) : null,
  }));
}

/**
 * One post for a page. Visitors and members see it only if the public rule
 * allows; its author's side and staff can also open it while it is a draft,
 * waiting for review, or taken down.
 */
export async function getPostFor(postId: string, viewer: SessionPayload | null): Promise<{ post: PostView; mine: boolean; staff: boolean } | null> {
  const row = await prisma.post.findUnique({ where: { id: postId }, include: { media: true } });
  if (!row) return null;
  const staff = viewer?.role === "SUPER_ADMIN";
  const mineIds = viewer ? await profileIdsOf(viewer) : new Set<string>();
  const mine = mineIds.has(row.authorProfileId) || (!!row.actingAsProfileId && mineIds.has(row.actingAsProfileId));
  if (!isPubliclyVisible(row, { signedIn: !!viewer }) && !mine && !staff) return null;
  return { post: (await toViews([row], viewer))[0], mine, staff };
}

export async function myPosts(session: SessionPayload): Promise<PostView[]> {
  const ids = [...(await profileIdsOf(session))];
  if (ids.length === 0) return [];
  const rows = await prisma.post.findMany({ where: { OR: [{ authorProfileId: { in: ids } }, { actingAsProfileId: { in: ids } }] }, orderBy: { updatedAt: "desc" }, take: 100, include: { media: true } });
  return toViews(rows, session);
}

/** The reviewer's list: posts in a given status, oldest first so nothing waits forever. */
export async function postsForReview(status: PostStatus, take = 50): Promise<PostView[]> {
  const rows = await prisma.post.findMany({ where: { status }, orderBy: { submittedAt: "asc" }, take, include: { media: true } });
  return toViews(rows, { userId: "reviewer", email: "", role: "SUPER_ADMIN" });
}

/** Prisma filter for "what the public may see". Use this wherever posts are listed, so the rule lives in one place. */
export function publicPostWhere(signedIn: boolean): Prisma.PostWhereInput {
  return { status: "PUBLISHED", orgBlockedAt: null, ...(signedIn ? {} : { visibility: "PUBLIC" }) };
}

export type { Profile };

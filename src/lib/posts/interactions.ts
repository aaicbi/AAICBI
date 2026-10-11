import type { Post, Profile } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import type { SessionPayload } from "@/lib/auth/session";
import { profileForSession, recipientOf } from "@/lib/profiles/handleChanges";
import { cardsFor, type ProfileCard } from "@/lib/profiles/card";
import { loadProfileView } from "@/lib/profiles/view";
import { PostError, publicPostWhere, toViews, type PostView } from "@/lib/posts/posts";
import { isPubliclyVisible } from "@/lib/posts/postCore";
import { canReviewUser } from "@/lib/review/access";
import { syncEducationPosts } from "@/lib/posts/backfill";
import { syncShowcaseLazily } from "@/lib/posts/showcaseSync";
import { canDecide, canEscalate, canReturn, checkReason } from "@/lib/review/reviewCore";
import { CommentSchema, LIMITS_PER_HOUR, ReportSchema, REACTIONS, canRemoveComment, decodeCursor, encodeCursor, mentionsIn, normalizeTag, type ReactionKind } from "@/lib/posts/interactionCore";

/**
 * Taking part: reactions, comments, follows, bookmarks, reports, and the feed
 * itself. Every action is by a signed-in profile and only on posts that
 * profile may see (the public rule in postCore). Visitors can read; anything
 * they try to do is turned into "create an account" by the pages.
 */
export const PAGE = 10;

export interface Actor { session: SessionPayload; profile: Profile }

/** The profile a signed-in person acts as (themselves, or the organization for an organization login). */
export async function actorOf(session: SessionPayload | null): Promise<Actor | null> {
  if (!session) return null;
  const profile = await profileForSession(session);
  return profile ? { session, profile } : null;
}

async function limit(key: string, max: number) {
  const r = await rateLimit(key, max, 60 * 60 * 1000);
  if (!r.allowed) throw new PostError("You are doing that very quickly. Please wait a little while.", 429);
}

async function inApp(profileId: string, n: { type: string; title: string; body: string; url: string }) {
  try {
    const p = await prisma.profile.findUnique({ where: { id: profileId } });
    const who = p ? await recipientOf(p) : null;
    if (who) await prisma.userNotification.create({ data: { recipientType: who.recipientType, recipientId: who.recipientId, ...n } });
  } catch (e) {
    console.error("In-app notification failed:", e instanceof Error ? e.message : e);
  }
}

/** The post, but only if this actor may see it. Everything below goes through this. */
async function visiblePost(postId: string, actor: Actor): Promise<Post> {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !isPubliclyVisible(post, { signedIn: true })) throw new PostError("Post not found.", 404);
  return post;
}

// ---- Stats shown on every post ----

export interface PostStats {
  reactions: Record<ReactionKind, number>;
  mine: ReactionKind | null;
  comments: number;
  bookmarked: boolean;
}

export async function statsFor(postIds: string[], actor: Actor | null): Promise<Map<string, PostStats>> {
  const out = new Map<string, PostStats>(postIds.map((id) => [id, { reactions: { LIKE: 0, INSIGHTFUL: 0, CELEBRATE: 0, DISLIKE: 0 }, mine: null, comments: 0, bookmarked: false }]));
  if (postIds.length === 0) return out;
  const [rx, cm, mine, bm] = await Promise.all([
    prisma.postReaction.groupBy({ by: ["postId", "kind"], where: { postId: { in: postIds } }, _count: { _all: true } }),
    prisma.postComment.groupBy({ by: ["postId"], where: { postId: { in: postIds }, status: "VISIBLE" }, _count: { _all: true } }),
    actor ? prisma.postReaction.findMany({ where: { postId: { in: postIds }, profileId: actor.profile.id }, select: { postId: true, kind: true } }) : Promise.resolve([]),
    actor ? prisma.bookmark.findMany({ where: { postId: { in: postIds }, profileId: actor.profile.id }, select: { postId: true } }) : Promise.resolve([]),
  ]);
  for (const r of rx) out.get(r.postId)!.reactions[r.kind] = r._count._all;
  for (const c of cm) out.get(c.postId)!.comments = c._count._all;
  for (const m of mine) out.get(m.postId)!.mine = m.kind;
  for (const b of bm) out.get(b.postId)!.bookmarked = true;
  return out;
}

// ---- Reactions ----

/** Sets (or, with null, removes) the actor's one reaction on a post. */
export async function setReaction(actor: Actor, postId: string, kind: ReactionKind | null): Promise<void> {
  await limit(`react:${actor.profile.id}`, LIMITS_PER_HOUR.reactions);
  await visiblePost(postId, actor);
  if (kind === null) {
    await prisma.postReaction.deleteMany({ where: { postId, profileId: actor.profile.id } });
    return;
  }
  if (!(REACTIONS as readonly string[]).includes(kind)) throw new PostError("Unknown reaction.", 400);
  await prisma.postReaction.upsert({ where: { postId_profileId: { postId, profileId: actor.profile.id } }, create: { postId, profileId: actor.profile.id, kind }, update: { kind } });
}

// ---- Comments ----

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string;
  removed: boolean;
  createdAt: string;
  author: ProfileCard;
  mine: boolean;
  replies: CommentView[];
}

export async function addComment(actor: Actor, postId: string, raw: unknown): Promise<string> {
  const parsed = CommentSchema.safeParse(raw);
  if (!parsed.success) throw new PostError(parsed.error.issues[0]?.message ?? "Check the comment.", 400);
  await limit(`comment:${actor.profile.id}`, LIMITS_PER_HOUR.comments);
  const post = await visiblePost(postId, actor);
  let parent: { id: string; authorProfileId: string } | null = null;
  if (parsed.data.parentId) {
    const p = await prisma.postComment.findUnique({ where: { id: parsed.data.parentId }, select: { id: true, postId: true, parentId: true, authorProfileId: true, status: true } });
    if (!p || p.postId !== postId || p.status !== "VISIBLE") throw new PostError("The comment you are replying to is not available.", 404);
    // Replies go one level deep: answering a reply attaches to the same top-level comment.
    parent = { id: p.parentId ?? p.id, authorProfileId: p.authorProfileId };
  }
  const c = await prisma.postComment.create({ data: { postId, authorProfileId: actor.profile.id, parentId: parent?.id ?? null, body: parsed.data.body } });
  const url = `/post/${postId}#comment-${c.id}`;
  const me = (await cardsFor([actor.profile])).get(actor.profile.id)?.name ?? "Someone";
  if (post.authorProfileId !== actor.profile.id) await inApp(post.authorProfileId, { type: "POST_COMMENT", title: `${me} commented on your post`, body: parsed.data.body.slice(0, 140), url });
  if (parent && parent.authorProfileId !== actor.profile.id && parent.authorProfileId !== post.authorProfileId) await inApp(parent.authorProfileId, { type: "POST_COMMENT", title: `${me} replied to your comment`, body: parsed.data.body.slice(0, 140), url });
  // People @mentioned in a comment hear about it too (once each, never yourself).
  for (const h of mentionsIn(parsed.data.body)) {
    const target = await prisma.profile.findUnique({ where: { handle: h }, select: { id: true } });
    if (target && target.id !== actor.profile.id && target.id !== post.authorProfileId) await inApp(target.id, { type: "POST_MENTION", title: `${me} mentioned you in a comment`, body: parsed.data.body.slice(0, 140), url });
  }
  return c.id;
}

export async function commentsFor(postId: string, actor: Actor | null): Promise<CommentView[]> {
  const rows = await prisma.postComment.findMany({ where: { postId }, orderBy: { createdAt: "asc" }, take: 300 });
  const profileIds = [...new Set(rows.map((r) => r.authorProfileId))];
  const profiles = await prisma.profile.findMany({ where: { id: { in: profileIds } } });
  const cards = await cardsFor(profiles);
  const view = (r: (typeof rows)[number]): CommentView => ({ id: r.id, parentId: r.parentId, body: r.status === "VISIBLE" ? r.body : "", removed: r.status !== "VISIBLE", createdAt: r.createdAt.toISOString(), author: cards.get(r.authorProfileId)!, mine: actor?.profile.id === r.authorProfileId, replies: [] });
  const top = rows.filter((r) => !r.parentId).map(view);
  const byId = new Map(top.map((t) => [t.id, t]));
  for (const r of rows.filter((x) => x.parentId)) byId.get(r.parentId!)?.replies.push(view(r));
  // A removed comment is kept as a placeholder only when it still has replies under it.
  return top.filter((t) => !t.removed || t.replies.length > 0).slice(-60);
}

/** The author, the post's own side, or a reviewer may remove a comment. */
export async function removeComment(actor: Actor, commentId: string): Promise<void> {
  const c = await prisma.postComment.findUnique({ where: { id: commentId } });
  if (!c || c.status !== "VISIBLE") throw new PostError("Comment not found.", 404);
  const post = await prisma.post.findUnique({ where: { id: c.postId }, select: { authorProfileId: true, actingAsProfileId: true } });
  const reviewer = await canReviewUser(actor.session.userId, actor.session.role);
  const ok = canRemoveComment({ isAuthor: c.authorProfileId === actor.profile.id, isPostSide: !!post && (post.authorProfileId === actor.profile.id || post.actingAsProfileId === actor.profile.id), isReviewer: reviewer });
  if (!ok) throw new PostError("You cannot remove that comment.", 403);
  await prisma.postComment.update({ where: { id: commentId }, data: { status: "REMOVED" } });
}

// ---- Follows ----

export async function follow(actor: Actor, targetProfileId: string): Promise<void> {
  await limit(`follow:${actor.profile.id}`, LIMITS_PER_HOUR.follows);
  if (targetProfileId === actor.profile.id) throw new PostError("You cannot follow yourself.", 400);
  const target = await prisma.profile.findUnique({ where: { id: targetProfileId } });
  // Only profiles this person can see can be followed, so following cannot be used to probe for hidden accounts.
  if (!target || !(await loadProfileView(target, actor.session))) throw new PostError("Profile not found.", 404);
  const existing = await prisma.follow.findUnique({ where: { followerProfileId_followedProfileId: { followerProfileId: actor.profile.id, followedProfileId: targetProfileId } } });
  if (existing) return;
  await prisma.follow.create({ data: { followerProfileId: actor.profile.id, followedProfileId: targetProfileId } });
  const me = (await cardsFor([actor.profile])).get(actor.profile.id)?.name ?? "Someone";
  await inApp(targetProfileId, { type: "NEW_FOLLOWER", title: `${me} started following you`, body: "Open their profile to see who they are.", url: `/@${actor.profile.handle}` });
}

export async function unfollow(actor: Actor, targetProfileId: string): Promise<void> {
  await prisma.follow.deleteMany({ where: { followerProfileId: actor.profile.id, followedProfileId: targetProfileId } });
}

export async function followCounts(profileId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([prisma.follow.count({ where: { followedProfileId: profileId } }), prisma.follow.count({ where: { followerProfileId: profileId } })]);
  return { followers, following };
}

export async function followingSet(actor: Actor | null, ids: string[]): Promise<Set<string>> {
  if (!actor || ids.length === 0) return new Set();
  const rows = await prisma.follow.findMany({ where: { followerProfileId: actor.profile.id, followedProfileId: { in: ids } }, select: { followedProfileId: true } });
  return new Set(rows.map((r) => r.followedProfileId));
}

/** The people following a profile, for signed-in viewers only, and only those whose own profile the viewer may see. */
export async function followersOf(profileId: string, viewer: SessionPayload, cursor?: string | null, take = 20): Promise<{ people: ProfileCard[]; next: string | null }> {
  const c = decodeCursor(cursor);
  const rows = await prisma.follow.findMany({
    where: { followedProfileId: profileId, ...(c ? { OR: [{ createdAt: { lt: c.at } }, { createdAt: c.at, followerProfileId: { lt: c.id } }] } : {}) },
    orderBy: [{ createdAt: "desc" }, { followerProfileId: "desc" }],
    take: take + 1,
  });
  const page = rows.slice(0, take);
  const profiles = await prisma.profile.findMany({ where: { id: { in: page.map((r) => r.followerProfileId) } } });
  const cards = await cardsFor(profiles);
  const people: ProfileCard[] = [];
  for (const r of page) {
    const p = profiles.find((x) => x.id === r.followerProfileId);
    if (p && (await loadProfileView(p, viewer))) people.push(cards.get(p.id)!);
  }
  const last = page[page.length - 1];
  return { people, next: rows.length > take && last ? encodeCursor(last.createdAt, last.followerProfileId) : null };
}

// ---- Bookmarks ----

export async function setBookmark(actor: Actor, postId: string, on: boolean): Promise<void> {
  await limit(`bookmark:${actor.profile.id}`, LIMITS_PER_HOUR.bookmarks);
  if (!on) {
    await prisma.bookmark.deleteMany({ where: { profileId: actor.profile.id, postId } });
    return;
  }
  await visiblePost(postId, actor);
  await prisma.bookmark.upsert({ where: { profileId_postId: { profileId: actor.profile.id, postId } }, create: { profileId: actor.profile.id, postId }, update: {} });
}

// ---- Reports ----

export async function report(actor: Actor, postId: string, raw: unknown): Promise<void> {
  const parsed = ReportSchema.safeParse(raw);
  if (!parsed.success) throw new PostError(parsed.error.issues[0]?.message ?? "Check the report.", 400);
  await limit(`report:${actor.profile.id}`, LIMITS_PER_HOUR.reports);
  await visiblePost(postId, actor);
  const commentId = parsed.data.commentId ?? null;
  if (commentId) {
    const c = await prisma.postComment.findUnique({ where: { id: commentId }, select: { postId: true, status: true } });
    if (!c || c.postId !== postId || c.status !== "VISIBLE") throw new PostError("Comment not found.", 404);
  }
  const targetKind = commentId ? "COMMENT" : "POST";
  const dup = await prisma.postReport.findFirst({ where: { targetKind, postId, commentId, reporterProfileId: actor.profile.id, status: "OPEN" } });
  if (dup) throw new PostError("You have already reported this. A reviewer will look at it.", 409);
  await prisma.postReport.create({ data: { targetKind, postId, commentId, reporterProfileId: actor.profile.id, reason: parsed.data.reason, details: parsed.data.details } });
}

type Reviewer = { userId: string; name: string; isSuperAdmin: boolean };

/** A reviewer decides a report: dismiss it, take the post down or remove the comment, or escalate it. */
export async function decideReport(reportId: string, action: "dismiss" | "action" | "escalate" | "return", note: unknown, actor: Reviewer): Promise<void> {
  const r = await prisma.postReport.findUnique({ where: { id: reportId } });
  if (!r || r.status !== "OPEN") throw new PostError("That report was already dealt with.", 404);
  if (action === "return") {
    if (!canReturn(actor, r)) throw new PostError("Only a super admin can send an escalated report back.", 403);
    await prisma.postReport.update({ where: { id: reportId }, data: { escalatedAt: null, escalatedById: null, escalationNote: null } });
    return;
  }
  const reason = checkReason(note);
  if (!reason.ok) throw new PostError(reason.error, 400);
  if (action === "escalate") {
    if (!canEscalate(actor, r)) throw new PostError(actor.isSuperAdmin ? "You are the super admin: please decide it." : "This report is already escalated.", 409);
    await prisma.postReport.update({ where: { id: reportId }, data: { escalatedAt: new Date(), escalatedById: actor.userId, escalationNote: reason.note } });
    return;
  }
  if (!canDecide(actor, r)) throw new PostError("This report was escalated to a super admin, who will decide it.", 403);
  if (action === "action") {
    if (r.targetKind === "COMMENT" && r.commentId) await prisma.postComment.updateMany({ where: { id: r.commentId }, data: { status: "REMOVED" } });
    else await prisma.post.updateMany({ where: { id: r.postId, status: "PUBLISHED" }, data: { status: "SUSPENDED", reviewNote: reason.note } });
    if (r.targetKind === "POST") await prisma.postReview.create({ data: { postId: r.postId, action: "SUSPENDED", actorId: actor.userId, actorName: actor.name, note: `After a report: ${reason.note}` } });
  }
  await prisma.postReport.update({ where: { id: reportId }, data: { status: action === "dismiss" ? "DISMISSED" : "ACTIONED", decidedById: actor.userId, decidedByName: actor.name, decisionNote: reason.note, decidedAt: new Date(), escalatedAt: null, escalatedById: null, escalationNote: null } });
}

// ---- The feed ----

export type FeedPost = PostView & { stats: PostStats; authorFollowed: boolean; canFollowAuthor: boolean };

/** One page of the feed. Latest: everything public, newest first. Following: posts by (or for) the profiles you follow. */
export async function feedPage(opts: { tab: "latest" | "following"; actor: Actor | null; cursor?: string | null; take?: number; tag?: string | null }): Promise<{ posts: FeedPost[]; next: string | null }> {
  const take = opts.take ?? PAGE;
  await syncEducationPosts();
  await syncShowcaseLazily();
  const signedIn = !!opts.actor;
  const c = decodeCursor(opts.cursor);
  const where: Prisma.PostWhereInput = { ...publicPostWhere(signedIn), publishedAt: { not: null } };
  const and: Prisma.PostWhereInput[] = [];
  if (c) and.push({ OR: [{ publishedAt: { lt: c.at } }, { publishedAt: c.at, id: { lt: c.id } }] });
  if (opts.tag) and.push({ tags: { has: opts.tag } });
  if (opts.tab === "following") {
    if (!opts.actor) return { posts: [], next: null };
    const followed = (await prisma.follow.findMany({ where: { followerProfileId: opts.actor.profile.id }, select: { followedProfileId: true } })).map((f) => f.followedProfileId);
    and.push({ OR: [{ authorProfileId: { in: followed } }, { actingAsProfileId: { in: followed } }] });
  }
  const rows = await prisma.post.findMany({ where: and.length ? { AND: [where, ...and] } : where, orderBy: [{ publishedAt: "desc" }, { id: "desc" }], take: take + 1, include: { media: true } });
  const page = rows.slice(0, take);
  return { posts: await withStats(page, opts.actor), next: rows.length > take ? encodeCursor(page[page.length - 1].publishedAt!, page[page.length - 1].id) : null };
}

async function withStats(rows: Array<Post & { media: Array<{ url: string; alt: string | null; order: number }> }>, actor: Actor | null): Promise<FeedPost[]> {
  const views = await toViews(rows, actor?.session ?? null);
  const stats = await statsFor(rows.map((r) => r.id), actor);
  const authors = [...new Set(views.map((v) => v.actingAs?.profileId ?? v.author.profileId))];
  const followed = await followingSet(actor, authors);
  return views.map((v) => {
    const subject = v.actingAs?.profileId ?? v.author.profileId;
    return { ...v, stats: stats.get(v.id)!, authorFollowed: followed.has(subject), canFollowAuthor: !actor || actor.profile.id !== subject };
  });
}

/** One already-loaded post with its reactions, comments and follow state, for the single-post page. */
export async function feedPostOf(post: PostView, actor: Actor | null): Promise<FeedPost> {
  const stats = await statsFor([post.id], actor);
  const subject = post.actingAs?.profileId ?? post.author.profileId;
  const followed = await followingSet(actor, [subject]);
  return { ...post, stats: stats.get(post.id)!, authorFollowed: followed.has(subject), canFollowAuthor: !actor || actor.profile.id !== subject };
}

/** Posts the actor saved, newest save first (only those still public). */
export async function savedPosts(actor: Actor): Promise<FeedPost[]> {
  const marks = await prisma.bookmark.findMany({ where: { profileId: actor.profile.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const rows = await prisma.post.findMany({ where: { id: { in: marks.map((m) => m.postId) }, ...publicPostWhere(true) }, include: { media: true } });
  const order = new Map(marks.map((m, i) => [m.postId, i]));
  rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return withStats(rows, actor);
}

/** Posts matching a search: words in the text or title, or an exact topic. Public posts only. */
export async function searchPosts(q: string | null, actor: Actor | null, take = 20, opts: { type?: "TEXT" | "IMAGE" | "YOUTUBE" | null; skip?: number } = {}): Promise<FeedPost[]> {
  const tag = q && q.startsWith("#") ? normalizeTag(q) : null;
  const word = (q ?? "").replace(/^#/, "");
  const rows = await prisma.post.findMany({
    where: {
      ...publicPostWhere(!!actor),
      publishedAt: { not: null },
      ...(opts.type ? { type: opts.type } : {}),
      ...(word ? { OR: [{ body: { contains: word, mode: "insensitive" } }, { title: { contains: word, mode: "insensitive" } }, ...(tag ? [{ tags: { has: tag } }] : [])] } : {}),
    },
    orderBy: { publishedAt: "desc" },
    skip: opts.skip ?? 0,
    take,
    include: { media: true },
  });
  return withStats(rows, actor);
}

// ---- Discovery ----

/** Topics people are posting about this week. Counted by how many different people used them, so one account repeating itself cannot make a topic trend. */
export async function trendingTags(take = 6, days = 7, minAuthors = 2): Promise<Array<{ tag: string; people: number }>> {
  const rows = await prisma.$queryRaw<Array<{ tag: string; people: bigint }>>`
    SELECT t AS tag, COUNT(DISTINCT p."authorProfileId") AS people
    FROM "Post" p, unnest(p.tags) AS t
    WHERE p.status = 'PUBLISHED' AND p."orgBlockedAt" IS NULL AND p.visibility = 'PUBLIC' AND p."publishedAt" > now() - make_interval(days => ${days}::int)
    GROUP BY t HAVING COUNT(DISTINCT p."authorProfileId") >= ${minAuthors}
    ORDER BY people DESC, t ASC LIMIT ${take}`;
  return rows.map((r) => ({ tag: r.tag, people: Number(r.people) }));
}

/** Profiles worth following: organizations and startups people can see, most followed first, not yourself and not already followed. */
export async function suggestions(actor: Actor | null, take = 4): Promise<Array<ProfileCard & { followers: number; followed: boolean }>> {
  const candidates = await prisma.profile.findMany({ where: { kind: { in: ["TRAINING_ORG", "STARTUP"] }, ...(actor ? { id: { not: actor.profile.id } } : {}) }, take: 60 });
  const counts = await prisma.follow.groupBy({ by: ["followedProfileId"], where: { followedProfileId: { in: candidates.map((p) => p.id) } }, _count: { _all: true } });
  const n = new Map(counts.map((c) => [c.followedProfileId, c._count._all]));
  const followed = await followingSet(actor, candidates.map((p) => p.id));
  const ordered = candidates.filter((p) => !followed.has(p.id)).sort((a, b) => (n.get(b.id) ?? 0) - (n.get(a.id) ?? 0) || a.handle.localeCompare(b.handle));
  const out: Array<ProfileCard & { followers: number; followed: boolean }> = [];
  const cards = await cardsFor(ordered.slice(0, 20));
  for (const p of ordered) {
    if (out.length >= take) break;
    if (await loadProfileView(p, actor?.session ?? null)) out.push({ ...cards.get(p.id)!, followers: n.get(p.id) ?? 0, followed: false });
  }
  return out;
}

/** A profile's own public posts (written by it, or for it as a startup or organization), newest first. */
export async function postsOfProfile(profileId: string, actor: Actor | null, take = 10): Promise<FeedPost[]> {
  const rows = await prisma.post.findMany({
    where: { ...publicPostWhere(!!actor), publishedAt: { not: null }, OR: [{ authorProfileId: profileId }, { actingAsProfileId: profileId }] },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take,
    include: { media: true },
  });
  return withStats(rows, actor);
}

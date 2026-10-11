import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import BackLink from "@/components/ui/BackLink";
import PostCard from "@/components/posts/PostCard";
import { getSession } from "@/lib/auth/session";
import { getPostFor } from "@/lib/posts/posts";
import { canReviewUser } from "@/lib/review/access";
import ReviewerPostActions from "@/components/posts/ReviewerPostActions";
import { STATUS_LABEL } from "@/lib/posts/postCore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const found = await getPostFor(params.id, await getSession());
  // A post nobody may see looks the same as one that does not exist.
  if (!found || found.post.status !== "PUBLISHED") return { title: "Post", robots: { index: false } };
  const p = found.post;
  return { title: `${p.author.name} on AAICBI`, description: (p.title ?? p.body).slice(0, 160) };
}

/** /post/[id]: one post. Public only once published; its author's side and reviewers can also open it while it is private. */
export default async function PostPage({ params }: { params: { id: string } }) {
  const viewer = await getSession();
  const reviewer = !!viewer && (await canReviewUser(viewer.userId, viewer.role));
  const found = await getPostFor(params.id, viewer, { reviewer });
  if (!found) notFound();
  const { post, mine } = found;
  return (
    <>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Feed", href: "/feed" }]} />
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <BackLink href={mine ? "/my-posts" : "/feed"}>{mine ? "Back to my posts" : "Back to feed"}</BackLink>
        {post.status !== "PUBLISHED" && (
          <div className="mt-3 rounded-2xl bg-brand-goldLight px-4 py-3 text-sm text-brand-goldText" role="status">
            <p className="font-semibold">{STATUS_LABEL[post.status]}. The public cannot see this post.</p>
            {post.reviewNote && <p className="mt-1">Reviewer: {post.reviewNote}</p>}
          </div>
        )}
        <div className="mt-3"><PostCard post={post} showStatus={mine} full /></div>
        {reviewer && <ReviewerPostActions postId={post.id} status={post.status} />}
        {mine && (post.status === "DRAFT" || post.status === "CHANGES_REQUESTED" || post.status === "PUBLISHED") && (
          <p className="mt-3 text-sm"><Link href={`/compose?edit=${post.id}`} className="font-semibold text-brand-teal hover:underline">Edit this post</Link></p>
        )}
      </main>
    </>
  );
}

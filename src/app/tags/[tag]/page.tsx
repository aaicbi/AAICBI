import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import BackLink from "@/components/ui/BackLink";
import SocialProvider from "@/components/posts/SocialProvider";
import FeedList from "@/components/posts/FeedList";
import { getSession } from "@/lib/auth/session";
import { actorOf, feedPage } from "@/lib/posts/interactions";
import { normalizeTag } from "@/lib/posts/interactionCore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { tag: string } }): Promise<Metadata> {
  const tag = normalizeTag(params.tag);
  return { title: tag ? `#${tag}` : "Topic", description: tag ? `Posts about ${tag} from the AAICBI community.` : undefined };
}

/** /tags/[tag]: public posts about a topic, newest first. */
export default async function TagPage({ params }: { params: { tag: string } }) {
  const tag = normalizeTag(params.tag);
  if (!tag) notFound();
  const actor = await actorOf(await getSession());
  const page = await feedPage({ tab: "latest", actor, tag });
  return (
    <SocialProvider signedIn={!!actor}>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Feed", href: "/feed" }]} />
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <BackLink href="/feed">Back to feed</BackLink>
        <h1 className="mt-3 font-display text-2xl font-semibold text-brand-ink">#{tag}</h1>
        <div className="mt-4">{page.posts.length === 0 ? <EmptyState title="No posts about this yet" description="Be the first to post with this topic." /> : <FeedList initial={page.posts} next={page.next} tab="latest" tag={tag} />}</div>
      </main>
    </SocialProvider>
  );
}

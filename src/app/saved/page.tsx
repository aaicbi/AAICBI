import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import EmptyState from "@/components/ui/EmptyState";
import Card from "@/components/ui/Card";
import SocialProvider from "@/components/posts/SocialProvider";
import PostItem from "@/components/posts/PostItem";
import { getSession } from "@/lib/auth/session";
import { actorOf, savedPosts } from "@/lib/posts/interactions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Saved posts", robots: { index: false } };

/** /saved: the posts you saved (only those still public). */
export default async function SavedPage() {
  const actor = await actorOf(await getSession());
  const posts = actor ? await savedPosts(actor) : [];
  return (
    <SocialProvider signedIn={!!actor}>
      <SiteHeader nav={[{ label: "Courses", href: "/courses" }, { label: "Feed", href: "/feed" }]} />
      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Saved posts</h1>
        {!actor ? <Card className="mt-4"><p className="text-sm text-gray-700">Sign in to see the posts you saved.</p><p className="mt-3 text-sm"><Link href="/trainee/login?next=%2Fsaved" className="font-semibold text-brand-teal hover:underline">Sign in</Link></p></Card>
          : posts.length === 0 ? <div className="mt-6"><EmptyState title="Nothing saved yet" description="Use Save under a post to keep it here." /></div>
          : <ul className="mt-4 space-y-4">{posts.map((p) => <li key={p.id}><PostItem post={p} /></li>)}</ul>}
      </main>
    </SocialProvider>
  );
}

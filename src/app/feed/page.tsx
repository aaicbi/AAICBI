import { notFound } from "next/navigation";
import type { Metadata } from "next";
import FeedHome from "@/components/ecosystem/FeedHome";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Community feed",
  description: "Posts, videos, projects and opportunities from the AAICBI community. Open to read; create an account to take part.",
};

/** /feed is the same feed as the home page, kept so existing links and tabs keep working. Dark (404) while the feed is switched off. */
export default async function FeedPage({ searchParams }: { searchParams: { tab?: string; type?: string; n?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.feed || !flags.orgPages) notFound();
  return <FeedHome searchParams={searchParams} base="/feed" />;
}

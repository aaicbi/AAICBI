import type { Metadata } from "next";
import FeedHome from "@/components/ecosystem/FeedHome";
import LegacyHome from "@/components/landing/LegacyHome";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "AAICBI · Africa's AI Capacity Building Initiative" },
  description: "The ecosystem where African AI talent, training organizations, employers, startups and investors meet. Read, search and explore without an account.",
};

/**
 * The home page is the ecosystem feed. If a super admin switches the feed (or organization pages) off in the ecosystem
 * settings, the earlier landing page is shown instead, which is the way back.
 */
export default async function HomePage({ searchParams }: { searchParams: { tab?: string; type?: string; n?: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.feed || !flags.orgPages) return <LegacyHome />;
  return <FeedHome searchParams={searchParams} base="/" />;
}

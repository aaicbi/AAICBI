import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import HomeHeader from "@/components/ecosystem/HomeHeader";
import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import { getSession } from "@/lib/auth/session";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { visitorGame } from "@/lib/quest/visitorPlay";
import { prisma } from "@/lib/prisma";
import LoopFace from "@/components/guide/LoopFace";
import { FORMAT_INFO, type GameFormat } from "@/lib/quest/games";
import PlayClient from "./PlayClient";
import Logo from "@/components/Logo";
import GrowthPlay from "@/components/growth/GrowthPlay";
import { duelPreview, publicCampaign } from "@/lib/growth/growth";
import { appUrl } from "@/lib/appUrl";
import { cleanSource } from "@/lib/growth/growthCore";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: { params: { id: string }; searchParams: { duel?: string } }): Promise<Metadata> {
  const campaign = await publicCampaign(params.id);
  if (campaign && campaign.live && typeof searchParams.duel === "string") {
    // A challenge link previews as the challenger's result card, so it looks good pasted into WhatsApp.
    const d = await duelPreview(params.id, searchParams.duel);
    if (d) {
      const image = appUrl(`/api/public/growth/${params.id}/card/${searchParams.duel}`);
      const title = `Can you beat ${d.name}'s ${d.score}/${d.total}?`;
      return { title, description: "Same 5 questions, 90 seconds, no signup.", openGraph: { title, description: "Same 5 questions, 90 seconds, no signup.", images: [{ url: image, width: 1200, height: 630 }] }, twitter: { card: "summary_large_image", images: [image] } };
    }
  }
  if (campaign) return campaign.live
    ? { title: `Do you think like an AI automation builder? ${campaign.courseTitle}`, description: "5 questions, 90 seconds, no signup. See your rank and challenge a friend.", openGraph: { title: "Can you beat my score?", description: `A 5-question taster from ${campaign.courseTitle}. No signup.` } }
    : { title: "Campaign ended" };
  const g = await visitorGame(params.id);
  return g ? { title: `Try: ${g.title}`, description: `A short free round from ${g.courseTitle}. No account needed.` } : { title: "Game not available" };
}

/** /play/[id] — a round of a game that staff opened to the feed. Needs a signed-in account (anyone), saves nothing, and points at the course when it goes badly. */
export default async function PlayPage({ params, searchParams }: { params: { id: string }; searchParams: { src?: string; duel?: string } }) {
  // A course campaign link (/play/<slug>) takes priority: it needs no account and no feed.
  const campaign = await publicCampaign(params.id);
  if (campaign) {
    const duel = campaign.live && typeof searchParams.duel === "string" ? await duelPreview(params.id, searchParams.duel) : null;
    return (
      <>
        <header className="mx-auto flex w-full max-w-md items-center justify-center px-4 pt-5"><Logo compact /></header>
        <main className="mx-auto w-full max-w-md px-4 py-5">
          {campaign.live ? (
            <GrowthPlay slug={campaign.slug} courseId={campaign.courseId} courseTitle={campaign.courseTitle} organizationName={campaign.organizationName} source={cleanSource(searchParams.src)} duel={duel ? { code: searchParams.duel as string, name: duel.name, score: duel.score, total: duel.total, rankLabel: duel.rank.label } : null} />
          ) : (
            <Card>
              <h1 className="font-display text-2xl font-bold text-brand-ink">This campaign has ended</h1>
              <p className="mt-2 text-brand-ink">The free game is closed, but you can still look at the course.</p>
              <Link href={`/courses/${campaign.courseId}`} className="mt-4 flex min-h-[52px] items-center justify-center rounded-full bg-brand-action px-6 text-base font-bold text-brand-onAccent hover:bg-brand-actionHover">See {campaign.courseTitle}</Link>
            </Card>
          )}
        </main>
      </>
    );
  }
  const flags = await getEcosystemFlags();
  if (!flags.feed) notFound();
  const [game, session] = await Promise.all([visitorGame(params.id), getSession()]);
  const enrolled = !!(game && session && session.role === "TRAINEE" && (await prisma.courseEnrollment.findFirst({ where: { courseId: game.courseId, traineeId: session.userId }, select: { id: true } })));
  return (
    <>
      <HomeHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <BackLink href="/">Back to the feed</BackLink>
        {!game ? (
          <Card className="mt-4">
            <p className="font-display font-semibold text-brand-ink">This game isn&apos;t open right now</p>
            <p className="mt-1 text-sm text-gray-600">It may have been switched off. <Link href="/" className="font-semibold text-brand-teal underline">Back to the feed</Link></p>
          </Card>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-bold text-brand-ink">{game.title}</h1>
            <p className="mt-1 text-sm text-gray-700">
              {FORMAT_INFO[game.format as GameFormat].blurb} A taste of <strong>{game.courseTitle}</strong>. No XP is paid, and your answers are recorded so the AAICBI team can see how the games are going.
            </p>
            {session ? (
              <div className="mt-4">
                <PlayClient id={game.id} title={game.title} courseId={game.courseId} courseTitle={game.courseTitle} enrolled={enrolled} />
              </div>
            ) : (
              <Card className="gx-rise mt-4 bg-card-gradient" data-testid="play-gate">
                <div className="flex items-start gap-3">
                  <span className="gx-bounce shrink-0"><LoopFace state="attention" size={64} /></span>
                  <div>
                    <h2 className="text-lg font-bold text-brand-ink">Sign in to play</h2>
                    <p className="mt-1 text-sm text-brand-ink">Create a free account, or sign in, to play {game.title}. It takes a minute, and then ten questions are yours.</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Link href="/join" className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="play-gate-join">Create a free account</Link>
                  <Link href={`/login?next=${encodeURIComponent(`/play/${game.id}`)}`} className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-brand-action px-5 text-sm font-semibold text-brand-action hover:bg-brand-mint" data-testid="play-gate-login">Log in</Link>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}

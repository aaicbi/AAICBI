import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";
import ViewBeacon from "@/components/ecosystem/ViewBeacon";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { PUBLIC_POST_WHERE } from "@/lib/ecosystem/queries";
import { getSession } from "@/lib/auth/session";
import { ReactionButtons } from "@/components/ecosystem/EngageButtons";

export const dynamic = "force-dynamic";

async function loadPost(id: string) {
  return prisma.educationPost.findFirst({
    where: { id, ...PUBLIC_POST_WHERE },
    select: {
      id: true, title: true, description: true, youtubeId: true, thumbnailUrl: true, category: true, moduleName: true, viewCount: true, publishedAt: true,
      _count: { select: { reactions: { where: { kind: "LIKE" } } } },
      trainee: { select: { name: true } },
      course: { select: { id: true, title: true } },
      skills: { select: { skill: { select: { name: true } } } },
      trainingOrganization: { select: { id: true, name: true, staffUserId: true, publicProfile: { select: { slug: true, verified: true } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const flags = await getEcosystemFlags();
  if (!flags.education || !flags.orgPages) return {};
  const post = await loadPost(params.id);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description ?? `${post.title} — presented by ${post.trainee.name}, published by ${post.trainingOrganization.name}.`,
    openGraph: { images: [post.thumbnailUrl] },
  };
}

/** /learn/[id] — watch page. The program suggestion is the organization's own published course, shown as a natural next step. */
export default async function WatchPage({ params }: { params: { id: string } }) {
  const flags = await getEcosystemFlags();
  if (!flags.education || !flags.orgPages) notFound();
  const post = await loadPost(params.id);
  if (!post) notFound();

  const org = post.trainingOrganization;
  const session = await getSession();
  const traineeId = session?.role === "TRAINEE" ? session.userId : null;
  const mine = traineeId ? await prisma.educationPostReaction.findMany({ where: { postId: post.id, traineeId }, select: { kind: true } }) : [];
  // Prefer the course the video was tagged with; otherwise the
  // organization's newest published course in the same category.
  const programSelect = { id: true, title: true, durationDisplay: true } as const;
  const tagged = post.course
    ? await prisma.course.findFirst({ where: { id: post.course.id, status: "PUBLISHED" }, select: programSelect })
    : null;
  const programDetail =
    tagged ??
    (org.staffUserId
      ? await prisma.course.findFirst({
          where: { createdById: org.staffUserId, status: "PUBLISHED", ...(post.category ? { category: post.category } : {}) },
          orderBy: { createdAt: "desc" },
          select: programSelect,
        })
      : null);

  return (
    <>
      <SiteHeader nav={[{ label: "Learn", href: "/learn" }, { label: "Organizations", href: "/organizations" }]} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${post.youtubeId}`}
            title={post.title}
            className="h-full w-full"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <ViewBeacon postId={post.id} />

        <h1 className="mt-5 font-display text-2xl font-semibold text-brand-ink">{post.title}</h1>
        <p className="mt-1 text-xs text-gray-500">{post.viewCount.toLocaleString("en")} views</p>
        <div className="mt-3">
          <ReactionButtons postId={post.id} initialLiked={mine.some((m) => m.kind === "LIKE")} initialSaved={mine.some((m) => m.kind === "SAVE")} initialLikeCount={post._count.reactions} signedIn={!!traineeId} nextPath={`/learn/${post.id}`} />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs uppercase tracking-wide text-gray-500">Created / presented by</p>
            <p className="mt-1 font-semibold text-brand-ink">{post.trainee.name}</p>
            <p className="text-sm text-gray-600">{post.course?.title ?? post.category ?? "Trainee"} Trainee</p>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide text-gray-500">Published by</p>
            {org.publicProfile ? (
              <Link href={`/organizations/${org.publicProfile.slug}`} className="mt-1 block font-semibold text-brand-teal hover:underline">
                {org.name}
              </Link>
            ) : (
              <p className="mt-1 font-semibold text-brand-ink">{org.name}</p>
            )}
            {org.publicProfile?.verified && <VerifiedBadge />}
          </Card>
        </div>

        {post.description && <p className="mt-5 whitespace-pre-line text-sm text-gray-700">{post.description}</p>}
        {post.skills.length > 0 && (
          <p className="mt-3 text-sm text-gray-600">Skills: {post.skills.map((s) => s.skill.name).join(", ")}</p>
        )}

        {programDetail && (
          <Card variant="highlighted" className="mt-8">
            <p className="font-display font-semibold text-brand-ink">Interested in learning this?</p>
            <p className="mt-1 text-sm text-gray-700">
              {programDetail.title} by {org.name}
              {programDetail.durationDisplay ? ` · ${programDetail.durationDisplay}` : ""}
            </p>
            <div className="mt-3 flex gap-2">
              <Button href={`/courses/${programDetail.id}`} size="sm">View program</Button>
              {org.publicProfile && (
                <Button href={`/organizations/${org.publicProfile.slug}`} variant="secondary" size="sm">View organization</Button>
              )}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}

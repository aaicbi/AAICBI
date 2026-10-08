import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import VerifiedBadge from "@/components/ecosystem/VerifiedBadge";
import VideoComments from "@/components/ecosystem/VideoComments";
import ViewBeacon from "@/components/ecosystem/ViewBeacon";
import { ProgramClick } from "@/components/ecosystem/EventBeacon";
import { prisma } from "@/lib/prisma";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { PUBLIC_POST_WHERE } from "@/lib/ecosystem/queries";
import { getSession } from "@/lib/auth/session";
import { ReactionButtons } from "@/components/ecosystem/EngageButtons";
import EducationVideoCard from "@/components/ecosystem/EducationVideoCard";
import { jobsForSkills, recommendPrograms, similarVideos } from "@/lib/ecosystem/recommend";
import { resolveViewer } from "@/lib/ecosystem/feed";
import VideoPlayer from "@/components/video/VideoPlayer";

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
  const skillNames = post.skills.map((s) => s.skill.name);
  const commentRows = await prisma.educationPostComment.findMany({
    where: { postId: post.id, status: "VISIBLE" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, body: true, createdAt: true, traineeId: true, trainee: { select: { name: true } } },
  });
  const comments = commentRows.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), authorName: c.trainee.name, mine: c.traineeId === traineeId }));
  const [programs, similar, viewer] = await Promise.all([
    recommendPrograms({ skills: skillNames, category: post.category, courseId: post.course?.id ?? null, organizationId: org.id }, 2),
    similarVideos(post.id, skillNames, 3),
    resolveViewer(session),
  ]);
  // Jobs follow the same rule as the feed: discoverable trainees only.
  const jobs = viewer.canBrowseJobs ? await jobsForSkills(skillNames, 3) : [];
  const isEmployer = session?.role === "EMPLOYER";

  return (
    <>
      <SiteHeader nav={[{ label: "Learn", href: "/learn" }, { label: "Organizations", href: "/organizations" }]} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <VideoPlayer source={{ kind: "youtube", id: post.youtubeId }} title={post.title} />
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

        {programs.length > 0 && (
          <Card variant="highlighted" className="mt-8">
            <p className="font-display font-semibold text-brand-ink">Interested in learning this?</p>
            <div className="mt-3 space-y-4">
              {programs.map((p) => (
                <div key={p.id}>
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold text-brand-ink">{p.title}</span> by {p.organizationName}
                    {p.durationDisplay ? ` · ${p.durationDisplay}` : ""}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <ProgramClick courseId={p.id} postId={post.id}><Button href={`/courses/${p.id}`} size="sm">View program</Button></ProgramClick>
                    {p.organizationSlug && <Button href={`/organizations/${p.organizationSlug}`} variant="secondary" size="sm">View organization</Button>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {(jobs.length > 0 || (isEmployer && skillNames.length > 0)) && (
          <Card className="mt-6">
            {jobs.length > 0 && (
              <>
                <p className="font-display font-semibold text-brand-ink">Jobs that use these skills</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-700">
                  {jobs.map((j) => (
                    <li key={j.id}>
                      <Link href="/trainee/job-postings" className="font-semibold text-brand-teal hover:underline">{j.title}</Link> · {j.employer.companyName}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {isEmployer && skillNames.length > 0 && (
              <div className={jobs.length > 0 ? "mt-4" : ""}>
                <p className="font-display font-semibold text-brand-ink">Looking for people with these skills?</p>
                <div className="mt-2">
                  <Button href={`/employer/discover?skill=${encodeURIComponent(skillNames[0])}`} size="sm" variant="secondary">Find similar talent</Button>
                </div>
              </div>
            )}
          </Card>
        )}

        <VideoComments postId={post.id} initial={comments} signedIn={!!traineeId} nextPath={`/learn/${post.id}`} />

        {similar.length > 0 && (
          <section aria-labelledby="similar" className="mt-10">
            <h2 id="similar" className="font-display text-lg font-semibold text-brand-ink">More on these skills</h2>
            <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-3">
              {similar.map((v) => <EducationVideoCard key={v.id} post={v} />)}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

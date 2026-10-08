import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { CreateEducationPostSchema, normalizeSkills } from "@/lib/ecosystem/educationPostCore";
import { fetchYouTubeMeta, parseYouTubeUrl } from "@/lib/ecosystem/youtube";
import { orgTraineeWhere, requireOrgCourse, requireOrgTrainee } from "@/lib/ecosystem/orgScope";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { ensureSkill } from "@/lib/ecosystem/skills";

/**
 * GET/POST /api/org/education-posts — a training organization publishing
 * educational videos on behalf of its own trainees. Every query is keyed
 * to the signed-in organization; the trainee and course in a POST are
 * checked against that organization before anything is written.
 */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const staffUserId = org.staffUserId;
    const [posts, trainees, courses, profile] = await Promise.all([
      prisma.educationPost.findMany({
        where: { trainingOrganizationId: org.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, status: true, thumbnailUrl: true, viewCount: true, createdAt: true, publishedAt: true, reviewNote: true,
          youtubeUrl: true, description: true, submittedByTrainee: true, orgDecisionNote: true, escalatedAt: true,
          trainee: { select: { name: true } },
          course: { select: { title: true } },
        },
      }),
      staffUserId
        ? prisma.trainee.findMany({ where: orgTraineeWhere(staffUserId), orderBy: { name: "asc" }, select: { id: true, name: true } })
        : Promise.resolve([]),
      staffUserId
        ? prisma.course.findMany({ where: { createdById: staffUserId }, orderBy: { title: "asc" }, select: { id: true, title: true } })
        : Promise.resolve([]),
      prisma.organizationPublicProfile.findUnique({ where: { trainingOrganizationId: org.id }, select: { verified: true } }),
    ]);
    const flags = await getEcosystemFlags();
    return NextResponse.json({ posts, trainees, courses, verified: !!profile?.verified, enabled: flags.education });
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    // Shipped dark: nothing reaches trainees or the public until SUPER_ADMIN enables it.
    if (!(await getEcosystemFlags()).education) {
      return NextResponse.json({ error: "Education videos are not switched on for the platform yet." }, { status: 403 });
    }
    if (org.approvalState !== "APPROVED") {
      return NextResponse.json({ error: "Your organization must be approved first." }, { status: 403 });
    }
    const limited = await rateLimit(`org-edu-post:${org.id}`, 10, 24 * 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "You have reached today's limit for new videos. Try again tomorrow." }, { status: 429 });
    }

    const parsed = CreateEducationPostSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    }
    const d = parsed.data;
    const video = parseYouTubeUrl(d.youtubeUrl);
    if (!video) {
      return NextResponse.json({ error: "Paste a valid YouTube link (youtube.com or youtu.be)." }, { status: 400 });
    }

    const trainee = await requireOrgTrainee(org, d.traineeId);
    const course = d.courseId ? await requireOrgCourse(org, d.courseId) : null;

    // The same video cannot be posted twice by one organization.
    const duplicate = await prisma.educationPost.findFirst({
      where: { trainingOrganizationId: org.id, youtubeId: video.id, status: { not: "REMOVED" } },
      select: { id: true },
    });
    if (duplicate) {
      return NextResponse.json({ error: "This video has already been posted by your organization." }, { status: 409 });
    }

    const skillNames = normalizeSkills(d.skills);
    const post = await prisma.$transaction(async (tx) => {
      const skillIds: string[] = [];
      for (const name of skillNames) {
        const skill = await ensureSkill(tx, name);
        skillIds.push(skill.id);
      }
      const created = await tx.educationPost.create({
        data: {
          trainingOrganizationId: org.id,
          traineeId: trainee.id,
          courseId: course?.id ?? null,
          title: d.title,
          description: d.description || null,
          youtubeUrl: video.watchUrl,
          youtubeId: video.id,
          thumbnailUrl: video.thumbnailUrl,
          moduleName: d.moduleName || null,
          category: d.category || course?.category || null,
          topic: d.title,
          // The trainee must agree before anything about them is public.
          status: "AWAITING_CONSENT",
          skills: { create: skillIds.map((skillId) => ({ skillId })) },
        },
        select: { id: true },
      });
      await tx.userNotification.create({
        data: {
          recipientType: "TRAINEE",
          recipientId: trainee.id,
          type: "EDUCATION_CONSENT_REQUEST",
          title: `${org.name} wants to feature you in a video`,
          body: `"${d.title}" — review the request and choose whether it can be shown publicly.`,
          url: "/trainee/education-consent",
          senderLabel: org.name,
        },
      });
      return created;
    });
    return NextResponse.json({ id: post.id }, { status: 201 });
  });
}

/** POST /api/org/education-posts?preview=1 helper: oEmbed lookup so the form can suggest a title. */
export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    await requireTrainingOrgSession();
    const body = (await req.json().catch(() => null)) as { youtubeUrl?: string } | null;
    const video = body?.youtubeUrl ? parseYouTubeUrl(body.youtubeUrl) : null;
    if (!video) return NextResponse.json({ error: "Paste a valid YouTube link." }, { status: 400 });
    const meta = await fetchYouTubeMeta(video.watchUrl);
    return NextResponse.json({ id: video.id, thumbnailUrl: video.thumbnailUrl, embedUrl: video.embedUrl, title: meta?.title ?? null });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rateLimit";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { parseYouTubeUrl } from "@/lib/ecosystem/youtube";
import { normalizeSkills } from "@/lib/ecosystem/educationPostCore";
import { ensureSkill } from "@/lib/ecosystem/skills";
import { traineeOrganizations } from "@/lib/ecosystem/orgScope";
import { sendPushForNotification } from "@/lib/push/send";
import { SubmitVideoSchema, statusAfterSubmission } from "@/lib/ecosystem/videoSubmissionCore";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/trainee/videos — a trainee's own videos: the ones they
 * posted and the ones an organization posted about them, with where each
 * one stands. Posting is limited to organizations the trainee takes part in.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const [videos, orgs, flags] = await Promise.all([
      prisma.educationPost.findMany({
        where: { traineeId: session.userId, status: { not: "REMOVED" } },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, title: true, status: true, thumbnailUrl: true, youtubeUrl: true, createdAt: true, submittedByTrainee: true,
          orgDecisionNote: true, reviewNote: true, escalatedAt: true,
          trainingOrganization: { select: { name: true } },
        },
      }),
      traineeOrganizations(session.userId),
      getEcosystemFlags(),
    ]);
    return NextResponse.json({
      enabled: flags.education,
      organizations: orgs.map((o) => ({ id: o.id, name: o.name })),
      videos: videos.map(({ trainingOrganization, ...v }) => ({ ...v, organizationName: trainingOrganization.name })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    if (!(await getEcosystemFlags()).education) {
      return NextResponse.json({ error: "Education videos are not switched on for the platform yet." }, { status: 403 });
    }
    const limited = await rateLimit(`trainee-video:${session.userId}`, 5, 24 * 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "You have reached today's limit for new videos. Try again tomorrow." }, { status: 429 });
    }
    const parsed = SubmitVideoSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    }
    const d = parsed.data;
    const video = parseYouTubeUrl(d.youtubeUrl);
    if (!video) return NextResponse.json({ error: "Paste a valid YouTube link (youtube.com or youtu.be)." }, { status: 400 });

    const org = (await traineeOrganizations(session.userId)).find((o) => o.id === d.trainingOrganizationId);
    if (!org) return NextResponse.json({ error: "You can only post to an organization whose course you are enrolled in." }, { status: 403 });

    let courseId: string | null = null;
    let category: string | null = null;
    if (d.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: d.courseId, createdById: org.staffUserId ?? "none", courseEnrollments: { some: { traineeId: session.userId } } },
        select: { id: true, category: true },
      });
      if (!course) return NextResponse.json({ error: "Choose one of your courses with this organization." }, { status: 403 });
      courseId = course.id;
      category = course.category;
    }

    const duplicate = await prisma.educationPost.findFirst({
      where: { traineeId: session.userId, youtubeId: video.id, status: { not: "REMOVED" } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: "You have already posted this video." }, { status: 409 });

    const toAdmin = d.sendTo === "admin";
    const skillNames = normalizeSkills(d.skills);
    const post = await prisma.$transaction(async (tx) => {
      const skillIds: string[] = [];
      for (const name of skillNames) skillIds.push((await ensureSkill(tx, name)).id);
      const created = await tx.educationPost.create({
        data: {
          trainingOrganizationId: org.id,
          traineeId: session.userId,
          courseId,
          title: d.title,
          description: d.description || null,
          youtubeUrl: video.watchUrl,
          youtubeId: video.id,
          thumbnailUrl: video.thumbnailUrl,
          category,
          topic: d.title,
          status: statusAfterSubmission(d.sendTo),
          submittedByTrainee: true,
          // The trainee is the author, so there is no separate consent step.
          consentRespondedAt: new Date(),
          ...(toAdmin && { escalatedAt: new Date(), escalationNote: d.reason || "Sent straight to AAICBI by the trainee." }),
          skills: { create: skillIds.map((skillId) => ({ skillId })) },
        },
        select: { id: true },
      });
      if (!toAdmin) {
        await tx.userNotification.create({
          data: {
            recipientType: "TRAINING_ORG",
            recipientId: org.id,
            type: "EDUCATION_TRAINEE_SUBMISSION",
            title: "A trainee sent you a video to review",
            body: `"${d.title}" is waiting for your decision.`,
            url: "/admin/education",
          },
        });
      }
      return created;
    });
    if (!toAdmin) {
      await sendPushForNotification("TRAINING_ORG", org.id, { type: "EDUCATION_TRAINEE_SUBMISSION", title: "A trainee sent you a video to review", body: `"${d.title}" is waiting for your decision.`, url: "/admin/education" });
    }
    return NextResponse.json({ id: post.id, status: statusAfterSubmission(d.sendTo) }, { status: 201 });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { OrgDecisionSchema, statusAfterOrgDecision } from "@/lib/ecosystem/videoSubmissionCore";

/** POST /api/org/education-posts/[id]/decision — the organization approves or declines a video a trainee sent it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const parsed = OrgDecisionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    if (parsed.data.action === "decline" && parsed.data.note.length < 3) {
      return NextResponse.json({ error: "Tell the trainee briefly why, so they can improve it." }, { status: 400 });
    }

    const post = await prisma.educationPost.findFirst({
      where: { id: params.id, trainingOrganizationId: org.id, submittedByTrainee: true },
      select: { id: true, status: true, title: true, traineeId: true },
    });
    if (!post) return NextResponse.json({ error: "Video not found." }, { status: 404 });

    const profile = await prisma.organizationPublicProfile.findUnique({ where: { trainingOrganizationId: org.id }, select: { verified: true } });
    const next = statusAfterOrgDecision(post.status, parsed.data.action, !!profile?.verified);
    if (!next) return NextResponse.json({ error: "This video is not waiting for your decision." }, { status: 409 });

    const changed = await prisma.educationPost.updateMany({
      where: { id: post.id, status: "AWAITING_ORG" },
      data: {
        status: next,
        orgDecidedAt: new Date(),
        orgDecisionNote: parsed.data.note || null,
        ...(next === "PUBLISHED" && { publishedAt: new Date() }),
      },
    });
    if (changed.count === 0) return NextResponse.json({ error: "This video just changed. Refresh and try again." }, { status: 409 });

    await prisma.userNotification.create({
      data: {
        recipientType: "TRAINEE",
        recipientId: post.traineeId,
        type: "EDUCATION_ORG_DECISION",
        title: parsed.data.action === "approve" ? `${org.name} approved your video` : `${org.name} did not approve your video`,
        body: parsed.data.action === "approve"
          ? next === "PUBLISHED" ? `"${post.title}" is now public.` : `"${post.title}" now goes to AAICBI for a final check before it is public.`
          : `"${post.title}": ${parsed.data.note} You can send it to AAICBI for review from My Videos.`,
        url: "/trainee/videos",
        senderLabel: org.name,
      },
    });
    return NextResponse.json({ status: next });
  });
}

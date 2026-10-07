import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { projectApprovedEmail, projectRejectedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

const DecideSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/**
 * POST /api/admin/showcase/[id]/decide — copy of
 * .../job-postings/[id]/decide's own shape: refuses to re-decide
 * anything not still PENDING_REVIEW (a trainee who wants another look
 * at a REJECTED project resubmits via PATCH .../projects/[id], which
 * puts it back in PENDING_REVIEW itself — this route never re-opens
 * one directly), sets showcaseStatus/reviewedById/reviewedAt, emails
 * the trainee best-effort so a notification failure never blocks the
 * decision that already succeeded.
 *
 * Security audit finding — the sibling list route (GET /api/admin/showcase)
 * already blocks a training-org session outright (Project has no FK to
 * scope by). That guard was never carried over here: a training-org
 * session could previously POST directly to this route (bypassing the
 * list page's 404) and decide ANY trainee's project from ANY
 * organization. Matched here for consistency.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: { trainee: { select: { id: true, email: true, name: true } } },
    });
    if (!project || !project.listedInShowcase || project.showcaseStatus !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Project not found or already decided." }, { status: 404 });
    }

    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        showcaseStatus: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    });

    try {
      const showcaseUrl = appUrl(parsed.data.action === "APPROVE" ? `/showcase/${project.id}` : "/trainee/profile");
      const content =
        parsed.data.action === "APPROVE"
          ? projectApprovedEmail({ traineeName: project.trainee.name, projectTitle: project.title, showcaseUrl })
          : projectRejectedEmail({ traineeName: project.trainee.name, projectTitle: project.title, showcaseUrl });
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: project.trainee.id,
        to: project.trainee.email,
        type: parsed.data.action === "APPROVE" ? "PROJECT_APPROVED" : "PROJECT_REJECTED",
        relatedId: project.id,
        url: parsed.data.action === "APPROVE" ? `/showcase/${project.id}` : "/trainee/profile",
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (e) {
      console.error(`Project showcase decision notification failed for project ${project.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}

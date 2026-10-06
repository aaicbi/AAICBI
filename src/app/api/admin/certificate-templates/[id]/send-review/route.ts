import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgAccess } from "@/lib/trainingOrgStaff";
import { notifyByEmail } from "@/lib/notifications/log";
import { certificateTemplateReadyEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

/**
 * POST /api/admin/certificate-templates/[id]/send-review — emails the
 * organization the review link (its token already exists, generated at
 * template creation — see that route's own comment). Resending after
 * an edit is fine; it's the same link each time.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const template = await prisma.certificateTemplate.findUnique({
      where: { id: params.id },
      include: { trainingOrganization: { select: { name: true, contactName: true, email: true, id: true } } },
    });
    if (!template) {
      return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
    }
    await requireTrainingOrgAccess(template.trainingOrganization.id, session);
    if (template.approvedAt) {
      return NextResponse.json({ error: "This template is already approved." }, { status: 400 });
    }

    const reviewUrl = appUrl(`/certificate-templates/review/${template.reviewToken}`);
    const content = certificateTemplateReadyEmail({
      organizationName: template.trainingOrganization.contactName,
      templateName: template.name,
      reviewUrl,
    });
    await notifyByEmail({
      recipientType: "TRAINING_ORG",
      recipientId: template.trainingOrganization.id,
      to: template.trainingOrganization.email,
      type: "CERTIFICATE_TEMPLATE_READY",
      relatedId: template.id,
      url: `/certificate-templates/review/${template.reviewToken}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    return NextResponse.json({ ok: true, reviewUrl });
  });
}

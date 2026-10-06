import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgAccess } from "@/lib/trainingOrgStaff";
import {
  validateCertificateTemplateLogoFile,
  uploadCertificateTemplateLogo,
  deleteCertificateTemplateLogoBestEffort,
} from "@/lib/certificateTemplateLogo";

/**
 * POST/DELETE /api/admin/certificate-templates/[id]/logo — same shape
 * as POST/DELETE /api/employer/logo, keyed by the template's own id
 * (not the caller's session id) since SUPER_ADMIN is uploading on
 * behalf of a template they're designing, not for themselves.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const existing = await prisma.certificateTemplate.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
    }
    await requireTrainingOrgAccess(existing.trainingOrganizationId, session);
    if (existing.approvedAt) {
      return NextResponse.json({ error: "This template is already approved and can't be edited." }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    const validationError = validateCertificateTemplateLogoFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const url = await uploadCertificateTemplateLogo(file, `template-${params.id}`);
    const template = await prisma.certificateTemplate.update({
      where: { id: params.id },
      data: { logoUrl: url },
    });

    if (existing.logoUrl) {
      await deleteCertificateTemplateLogoBestEffort(existing.logoUrl);
    }

    return NextResponse.json(template);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    const existing = await prisma.certificateTemplate.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
    }
    await requireTrainingOrgAccess(existing.trainingOrganizationId, session);
    const template = await prisma.certificateTemplate.update({
      where: { id: params.id },
      data: { logoUrl: null },
    });
    if (existing.logoUrl) {
      await deleteCertificateTemplateLogoBestEffort(existing.logoUrl);
    }
    return NextResponse.json(template);
  });
}

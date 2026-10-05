import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { generateTemplateReviewToken } from "@/lib/certificateTemplateReview";
import { sanitizeCertificateHtml } from "@/lib/certificateHtmlSanitize";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  primaryColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #016B61."),
  accentColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #D99A34."),
  // Custom HTML Certificate Templates — optional at creation too, so
  // the design tool's single "Save" action works whether this is a
  // brand-new template or an edit (POST vs PATCH), without a confusing
  // first save that silently drops what's in the HTML textarea.
  customHtml: z.string().max(50_000).optional(),
  signatoryName: z.string().trim().max(100).optional(),
  signatoryTitle: z.string().trim().max(100).optional(),
});

/**
 * GET/POST /api/admin/training-organizations/[id]/certificate-templates
 * — SUPER_ADMIN's own design tool list + create. Logo upload is a
 * separate step (POST .../certificate-templates/[id]/logo), same
 * "create first, then upload its image" shape AvatarUpload already
 * establishes. The review token is generated here, at creation, not
 * deferred to "send for review" — it's just a stable address for the
 * public preview page; nothing requires it to stay secret until the
 * template is actually emailed anywhere.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const templates = await prisma.certificateTemplate.findMany({
      where: { trainingOrganizationId: params.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id } });
    if (!org) {
      return NextResponse.json({ error: "Training organization not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const template = await prisma.certificateTemplate.create({
      data: {
        trainingOrganizationId: org.id,
        name: parsed.data.name,
        primaryColor: parsed.data.primaryColor,
        accentColor: parsed.data.accentColor,
        customHtml: parsed.data.customHtml ? sanitizeCertificateHtml(parsed.data.customHtml) : null,
        signatoryName: parsed.data.signatoryName || null,
        signatoryTitle: parsed.data.signatoryTitle || null,
        reviewToken: generateTemplateReviewToken(),
      },
    });
    return NextResponse.json(template, { status: 201 });
  });
}

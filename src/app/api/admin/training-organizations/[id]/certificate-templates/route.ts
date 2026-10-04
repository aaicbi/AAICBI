import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { generateTemplateReviewToken } from "@/lib/certificateTemplateReview";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const CreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  primaryColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #016B61."),
  accentColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #D99A34."),
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
        reviewToken: generateTemplateReviewToken(),
      },
    });
    return NextResponse.json(template, { status: 201 });
  });
}

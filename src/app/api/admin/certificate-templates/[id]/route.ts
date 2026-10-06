import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { CertificateLayoutSchema } from "@/lib/certificateLayout";
import { requireTrainingOrgAccess } from "@/lib/trainingOrgStaff";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  primaryColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #016B61."),
  accentColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #D99A34."),
  // Visual Certificate Design Editor — CertificateLayoutSchema's own
  // parse IS the validation boundary here; there's no markup to
  // sanitize, just a bounded, enum-checked JSON shape. Null means "use
  // the AAICBI Classic preset" (CertificateDisplay's own fallback).
  layoutJson: CertificateLayoutSchema.nullable().optional(),
  signatoryName: z.string().trim().max(100).nullable().optional(),
  signatoryTitle: z.string().trim().max(100).nullable().optional(),
});

/**
 * PATCH /api/admin/certificate-templates/[id] — refuses to edit an
 * already-approved template. Once the organization has approved it,
 * it's locked — the same immutability the certificate code itself
 * already has once issued, rather than letting it silently change
 * underneath a decision the org already made.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const template = await prisma.certificateTemplate.findUnique({ where: { id: params.id } });
    if (!template) {
      return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
    }
    await requireTrainingOrgAccess(template.trainingOrganizationId, session);
    if (template.approvedAt) {
      return NextResponse.json({ error: "This template is already approved and can't be edited." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.certificateTemplate.update({
      where: { id: params.id },
      data: {
        name: parsed.data.name,
        primaryColor: parsed.data.primaryColor,
        accentColor: parsed.data.accentColor,
        layoutJson: parsed.data.layoutJson ?? Prisma.JsonNull,
        signatoryName: parsed.data.signatoryName || null,
        signatoryTitle: parsed.data.signatoryTitle || null,
      },
    });
    return NextResponse.json(updated);
  });
}

/**
 * DELETE /api/admin/certificate-templates/[id] — only an unapproved
 * template can be deleted, same lock this file's own PATCH already
 * enforces. No course-count guard needed: Course.certificateTemplateId
 * can only ever be set to an APPROVED template (enforced in
 * courses/[id]/route.ts's own PUT validation), so an unapproved
 * template — the only kind this route ever deletes — can never have a
 * course pointing at it in the first place.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const template = await prisma.certificateTemplate.findUnique({ where: { id: params.id } });
    if (!template) {
      return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
    }
    await requireTrainingOrgAccess(template.trainingOrganizationId, session);
    if (template.approvedAt) {
      return NextResponse.json({ error: "This template is already approved and can't be deleted." }, { status: 400 });
    }

    await prisma.certificateTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { sanitizeCertificateHtml } from "@/lib/certificateHtmlSanitize";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  primaryColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #016B61."),
  accentColor: z.string().regex(HEX_COLOR, "Enter a valid hex color, e.g. #D99A34."),
  // Custom HTML Certificate Templates — sanitized before storage (see
  // certificateHtmlSanitize.ts's own comment on why it's sanitized
  // again at render time too). Empty string and null both mean "use
  // the default CertificateCard design," normalized to null below.
  customHtml: z.string().max(50_000).nullable().optional(),
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
    await requireRole("SUPER_ADMIN");

    const template = await prisma.certificateTemplate.findUnique({ where: { id: params.id } });
    if (!template) {
      return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
    }
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
        customHtml: parsed.data.customHtml ? sanitizeCertificateHtml(parsed.data.customHtml) : null,
        signatoryName: parsed.data.signatoryName || null,
        signatoryTitle: parsed.data.signatoryTitle || null,
      },
    });
    return NextResponse.json(updated);
  });
}

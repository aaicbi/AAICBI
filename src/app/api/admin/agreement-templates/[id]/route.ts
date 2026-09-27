import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  content: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/agreement-templates/[id] — editing the template never
 * touches any InstructorAgreement already sent from it (those hold
 * their own immutable `content` snapshot). Bumps `version` whenever
 * `content` itself changes, so a future send can record which version
 * of the template it was generated from.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const existing = await prisma.agreementTemplate.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const contentChanged = parsed.data.content !== undefined && parsed.data.content !== existing.content;
    const updated = await prisma.agreementTemplate.update({
      where: { id: params.id },
      data: {
        name: parsed.data.name,
        content: parsed.data.content,
        isActive: parsed.data.isActive,
        version: contentChanged ? existing.version + 1 : existing.version,
      },
    });
    return NextResponse.json(updated);
  });
}

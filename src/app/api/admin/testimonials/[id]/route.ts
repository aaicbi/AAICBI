import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateSchema = z.object({ published: z.boolean() });

/**
 * PATCH/DELETE /api/admin/testimonials/[id] — take a published
 * testimonial down (or bring it back) without losing it, and genuine
 * deletion for one that shouldn't exist at all. Two real, different
 * actions, not one — unpublishing is reversible and keeps the record;
 * deleting isn't.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const testimonial = await prisma.testimonial.update({
      where: { id: params.id },
      data: { published: parsed.data.published },
    });
    return NextResponse.json(testimonial);
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await prisma.testimonial.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}

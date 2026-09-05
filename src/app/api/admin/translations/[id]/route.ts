import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const ApproveSchema = z.object({
  // An admin can edit the machine-drafted text before approving it —
  // approval isn't just "accept exactly what the API/AI produced,"
  // it's "this is now correct," which sometimes means fixing it first.
  translatedText: z.string().min(1),
});

/** Approve (optionally editing the text first) — the only way a
 * translation ever becomes something t() will actually return, never
 * automatic regardless of which drafting mechanism produced it. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = ApproveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const translation = await prisma.uiStringTranslation.update({
      where: { id: params.id },
      data: { translatedText: parsed.data.translatedText, approved: true, approvedById: session.userId },
    });
    return NextResponse.json(translation);
  });
}

/** Reject a draft outright — deletes it rather than leaving a
 * permanently-unapproved row sitting in the review queue forever. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await prisma.uiStringTranslation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}

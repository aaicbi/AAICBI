import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * DELETE /api/trainee/skills/[id] — [id] is the TraineeSkill row's own
 * id, not the trainee's. Ownership is checked directly (same discipline
 * as /api/notifications/[id]/read) before deleting — a row belonging to
 * someone else returns 404, identical to a row that doesn't exist at
 * all, so a manipulated id can never confirm another trainee's data.
 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const row = await prisma.traineeSkill.findUnique({ where: { id: params.id } });
    if (!row || row.traineeId !== session.userId) {
      return NextResponse.json({ error: "Skill not found." }, { status: 404 });
    }
    await prisma.traineeSkill.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}

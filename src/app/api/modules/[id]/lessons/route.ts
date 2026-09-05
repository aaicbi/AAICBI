import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";

const CreateLessonSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
});

/** POST /api/modules/[id]/lessons — append a lesson to a module, ordered last. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId);

    const body = await req.json();
    const parsed = CreateLessonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Same reasoning as the module-creation route: a transaction narrows
    // (without fully eliminating) the order-assignment race.
    // tx: any below is a sandbox-only workaround — prisma generate can't
    // run here (see README), so Prisma.TransactionClient isn't available
    // to infer from. A normal environment gets this typed automatically.
    const lesson = await prisma.$transaction(async (tx: any) => {
      const agg = await tx.lesson.aggregate({ where: { moduleId: params.id }, _max: { order: true } });
      return tx.lesson.create({
        data: {
          ...parsed.data,
          moduleId: params.id,
          order: (agg._max.order ?? -1) + 1,
        },
        include: { materials: true },
      });
    });
    return NextResponse.json(lesson, { status: 201 });
  });
}

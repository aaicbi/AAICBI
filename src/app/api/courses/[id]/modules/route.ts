import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedCourse } from "@/lib/courseOwnership";

const CreateModuleSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
});

/** POST /api/courses/[id]/modules — append a module to a course, ordered last. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedCourse(params.id, session.userId);

    const body = await req.json();
    const parsed = CreateModuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Wrapped in a transaction so the "find the current max order" read and
    // the "create at max+1" write happen as one unit rather than two
    // separate round-trips — narrows, though doesn't fully eliminate
    // without a stricter isolation level, the window where two concurrent
    // requests could read the same max and both land on the same order.
    // Reasonable for how this is actually used (one admin building a
    // course at a time) without reaching for table-level locking.
    // tx: any below is a sandbox-only workaround — prisma generate can't
    // run here (see README), so Prisma.TransactionClient isn't available
    // to infer from. A normal environment gets this typed automatically.
    const module_ = await prisma.$transaction(async (tx: any) => {
      const agg = await tx.module.aggregate({ where: { courseId: params.id }, _max: { order: true } });
      return tx.module.create({
        data: {
          ...parsed.data,
          courseId: params.id,
          order: (agg._max.order ?? -1) + 1,
        },
        include: { lessons: { include: { materials: true } } },
      });
    });
    return NextResponse.json(module_, { status: 201 });
  });
}

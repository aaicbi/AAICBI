import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedLesson } from "@/lib/courseOwnership";

const UpdateLessonSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedLesson(params.id, session.userId);

    const body = await req.json();
    const parsed = UpdateLessonSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.lesson.update({
      where: { id: params.id },
      data: parsed.data,
      include: { materials: true },
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedLesson(params.id, session.userId);
    await prisma.lesson.delete({ where: { id: params.id } }); // cascades to materials
    return NextResponse.json({ ok: true });
  });
}

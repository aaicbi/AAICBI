import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedModule } from "@/lib/courseOwnership";
import { guardModuleDeletable } from "@/lib/deletionGuards";

const UpdateModuleSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId);

    const body = await req.json();
    const parsed = UpdateModuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.module.update({
      where: { id: params.id },
      data: parsed.data,
      include: { lessons: { include: { materials: true } } },
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedModule(params.id, session.userId);
    await guardModuleDeletable(params.id); // M11 audit finding — see deletionGuards.ts
    await prisma.module.delete({ where: { id: params.id } }); // cascades to lessons/materials (and its assessment, if any and unattempted)
    return NextResponse.json({ ok: true });
  });
}

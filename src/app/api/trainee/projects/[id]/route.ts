import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { safeUrl } from "@/lib/materialUrl";

const ProjectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  url: safeUrl.optional().or(z.literal("")),
});

async function findOwned(id: string, traineeId: string) {
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row || row.traineeId !== traineeId) return null;
  return row;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const existing = await findOwned(params.id, session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    const body = await req.json();
    const parsed = ProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.project.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        url: parsed.data.url || null,
      },
    });
    return NextResponse.json(updated);
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const existing = await findOwned(params.id, session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}

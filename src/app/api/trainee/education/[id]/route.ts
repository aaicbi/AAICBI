import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const EducationSchema = z.object({
  institution: z.string().trim().min(1).max(160),
  credential: z.string().trim().max(160).optional().or(z.literal("")),
  fieldOfStudy: z.string().trim().max(160).optional().or(z.literal("")),
  startDate: z.string().datetime().optional().or(z.literal("")),
  endDate: z.string().datetime().optional().or(z.literal("")),
  current: z.boolean().default(false),
});

async function findOwned(id: string, traineeId: string) {
  const row = await prisma.education.findUnique({ where: { id } });
  if (!row || row.traineeId !== traineeId) return null;
  return row;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const existing = await findOwned(params.id, session.userId);
    if (!existing) {
      return NextResponse.json({ error: "Education entry not found." }, { status: 404 });
    }
    const body = await req.json();
    const parsed = EducationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const updated = await prisma.education.update({
      where: { id: params.id },
      data: {
        institution: parsed.data.institution,
        credential: parsed.data.credential || null,
        fieldOfStudy: parsed.data.fieldOfStudy || null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        current: parsed.data.current,
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
      return NextResponse.json({ error: "Education entry not found." }, { status: 404 });
    }
    await prisma.education.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  });
}

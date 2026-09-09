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

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const education = await prisma.education.findMany({
      where: { traineeId: session.userId },
      orderBy: [{ order: "asc" }, { startDate: "desc" }],
    });
    return NextResponse.json(education);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = EducationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const created = await prisma.education.create({
      data: {
        traineeId: session.userId,
        institution: parsed.data.institution,
        credential: parsed.data.credential || null,
        fieldOfStudy: parsed.data.fieldOfStudy || null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        current: parsed.data.current,
      },
    });
    return NextResponse.json(created, { status: 201 });
  });
}

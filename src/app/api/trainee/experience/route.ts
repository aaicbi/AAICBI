import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const ExperienceSchema = z.object({
  employerName: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  startDate: z.string().datetime().optional().or(z.literal("")),
  endDate: z.string().datetime().optional().or(z.literal("")),
  current: z.boolean().default(false),
});

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const experience = await prisma.workExperience.findMany({
      where: { traineeId: session.userId },
      orderBy: [{ order: "asc" }, { startDate: "desc" }],
    });
    return NextResponse.json(experience);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = ExperienceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const created = await prisma.workExperience.create({
      data: {
        traineeId: session.userId,
        employerName: parsed.data.employerName,
        title: parsed.data.title,
        description: parsed.data.description || null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
        current: parsed.data.current,
      },
    });
    return NextResponse.json(created, { status: 201 });
  });
}

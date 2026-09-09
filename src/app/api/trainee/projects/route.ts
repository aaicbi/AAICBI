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

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const projects = await prisma.project.findMany({
      where: { traineeId: session.userId },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(projects);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = ProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const created = await prisma.project.create({
      data: {
        traineeId: session.userId,
        title: parsed.data.title,
        description: parsed.data.description || null,
        url: parsed.data.url || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  });
}

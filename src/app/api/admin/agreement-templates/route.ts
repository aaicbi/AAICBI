import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const CreateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1),
});

/**
 * GET/POST /api/admin/agreement-templates — SUPER_ADMIN/ADMIN only
 * (never INSTRUCTOR — this is a management tool, not something an
 * instructor should see the raw editable template of). `content` uses
 * plain {{VARIABLE}} placeholders (e.g. {{INSTRUCTOR_NAME}},
 * {{MONTHLY_COMPENSATION}}), resolved into an immutable snapshot at
 * send time by POST /api/admin/instructors/[id]/agreement — this route
 * itself does no resolution, it's just template CRUD.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const templates = await prisma.agreementTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(templates);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    const body = await req.json();
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const template = await prisma.agreementTemplate.create({
      data: { name: parsed.data.name, content: parsed.data.content, createdById: session.userId },
    });
    return NextResponse.json(template, { status: 201 });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET/PUT /api/employer/settings — the third of M46's three UI
 * surfaces, closed here. Deliberately minimal, matching the same
 * "genuinely small settings surface, not a full profile-editing page"
 * reasoning the admin settings route's own comment already states —
 * just dark mode, since that's what M46 actually needed; no AI
 * assistant toggle or avatar upload here, both genuinely staff/
 * trainee-specific features, not part of this gap.
 */
const UpdateSettingsSchema = z.object({ darkMode: z.boolean() });

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const employer = await prisma.employer.findUniqueOrThrow({
      where: { id: session.userId },
      select: { darkMode: true },
    });
    return NextResponse.json(employer);
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const employer = await prisma.employer.update({
      where: { id: session.userId },
      data: { darkMode: parsed.data.darkMode },
      select: { darkMode: true },
    });
    return NextResponse.json(employer);
  });
}

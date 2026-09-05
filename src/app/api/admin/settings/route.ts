import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET/PUT /api/admin/settings — the staff counterpart to
 * /api/trainee/settings. M47's AI assistant toggle and M46's dark
 * mode preference — still a genuinely small, deliberate settings
 * surface, not a full profile-editing page.
 */
const UpdateSettingsSchema = z.object({
  aiAssistantEnabled: z.boolean(),
  darkMode: z.boolean(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: { aiAssistantEnabled: true, darkMode: true, avatarUrl: true },
    });
    return NextResponse.json(user);
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { aiAssistantEnabled: parsed.data.aiAssistantEnabled, darkMode: parsed.data.darkMode },
      select: { aiAssistantEnabled: true, darkMode: true },
    });
    return NextResponse.json(user);
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateSchema = z.object({
  defaultAiCreditAllowance: z.number().int().min(0).max(1_000_000),
});

/**
 * GET/PUT /api/admin/platform-settings — closes the last real piece of
 * M45's original scope: `PlatformSettings.defaultAiCreditAllowance`
 * has existed since the schema was fixed, but nothing anywhere ever
 * actually read or wrote it. A genuine singleton, so this always
 * upserts against the fixed `"singleton"` id rather than needing the
 * caller to know or track a real row id — see the schema comment on
 * `PlatformSettings` for why that pattern exists.
 *
 * SUPER_ADMIN only, not the broader staff set every other route in
 * this project uses — this is a genuinely platform-wide value, not
 * scoped to any one course or instructor's own work, and deserves the
 * narrower, more deliberate access every other cross-cutting setting
 * in this project gets.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
    return NextResponse.json(settings);
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const settings = await prisma.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", defaultAiCreditAllowance: parsed.data.defaultAiCreditAllowance },
      update: { defaultAiCreditAllowance: parsed.data.defaultAiCreditAllowance },
    });
    return NextResponse.json(settings);
  });
}

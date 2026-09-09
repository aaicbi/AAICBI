import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * Settings-page redesign — every field is `.optional()`, making this a
 * genuine partial-update (PATCH-shaped, despite the verb staying PUT to
 * match every other settings route in this project): the three
 * settings categories that write here (Payments, Security, and the
 * pre-existing AI-credit field) are now separate panels on the client,
 * each only sending the 1-2 fields it actually renders. An `undefined`
 * key in Prisma's `update`/`create` data means "don't touch this
 * field," not "clear it" — confirmed against Prisma's own documented
 * behavior — so one panel saving never overwrites another panel's
 * already-set values with defaults.
 */
const UpdateSchema = z.object({
  defaultAiCreditAllowance: z.number().int().min(0).max(1_000_000).optional(),
  // Settings-page redesign — surfaces `PlatformSettings.
  // qaWarningsBeforeSuspension`, which has existed since M41 (see the
  // schema's own comment and qaModeration.ts's escalation logic) but
  // never had an admin UI to actually change it; the `?? 3` fallback
  // in qaModeration.ts already establishes 3 as the effective floor
  // for "no threshold set" — min(1) here so an admin can't zero it out
  // into an instant-suspension-on-first-warning setting, which nothing
  // in the moderation flow was ever designed to expect.
  qaWarningsBeforeSuspension: z.number().int().min(1).max(100).optional(),
  // Settings-page redesign, Security category — see session.ts's
  // getSessionDurationHours for how these are actually consumed.
  // Bounded 1-168h (up to a week) for staff/employer — a session
  // longer than that stops looking like "convenience" and starts
  // looking like a forgotten-logout risk on a shared machine; trainee
  // is bounded 1-90 days to allow for a genuinely long course without
  // permitting an effectively-eternal session.
  staffSessionHours: z.number().int().min(1).max(168).optional(),
  traineeSessionDays: z.number().int().min(1).max(90).optional(),
  employerSessionHours: z.number().int().min(1).max(168).optional(),
  // Settings-page redesign, Payments category — see the schema's own
  // comment on why this is a UI-default only, not a change to
  // Course.reminderDaysBeforeExpiry's own column default. Empty array
  // allowed (an admin who wants no default reminders pre-filled) but
  // each individual value must be a positive day count.
  defaultReminderDaysBeforeExpiry: z.array(z.number().int().positive()).optional(),
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
      create: { id: "singleton", ...parsed.data },
      update: parsed.data,
    });
    return NextResponse.json(settings);
  });
}

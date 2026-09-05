import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

/**
 * GET/PUT /api/trainee/settings — closes a gap flagged repeatedly
 * across this project's audits: Trainee.notificationsEnabled has
 * existed since M14 with no way for a trainee (or staff on their
 * behalf) to actually change it except direct database access. The
 * privacy policy (Section 4) now promises "a trainee may ask AAICBI to
 * turn \[optional notifications\] off" — this is what makes that
 * promise something a trainee can act on themselves, not just
 * something staff could technically do with Prisma Studio.
 *
 * M39 added lowBandwidthMode to this same endpoint rather than a
 * second one, and M42 (technical piece) adds preferredLanguage the
 * same way — still a genuinely small, deliberate settings surface,
 * not a full profile-editing feature growing without bound. All three
 * fields are required on every PUT (not a partial update) — this
 * settings page always has all three visible together, so there's no
 * real case where a caller would want to change one without knowing
 * the others' current values.
 */
const UpdateSettingsSchema = z.object({
  notificationsEnabled: z.boolean(),
  lowBandwidthMode: z.boolean(),
  // M42 (technical piece) — deliberately a narrow, explicit enum of
  // exactly the languages this app actually has UI strings for today,
  // not an open string accepted from the client. Widening this list is
  // a one-line change whenever a language is actually supported; never
  // trusting arbitrary client input for it is not a tradeoff worth
  // revisiting.
  // M42 — expanded from just en/pcm to the full supported set,
  // sourced from SUPPORTED_LANGUAGES itself rather than a second,
  // separately-maintained list that could quietly drift from it.
  preferredLanguage: z.enum(SUPPORTED_LANGUAGES),
  // M45 — a real toggle, genuinely writable here even though nothing
  // reads it yet (Session 2's actual AI feature doesn't exist). Never
  // rejected or ignored just because it's currently inert — a trainee
  // should be able to turn it on/off today so the setting isn't a
  // surprise the first time it starts meaning something.
  aiStudyBuddyEnabled: z.boolean(),
  // M46 — a real, functional toggle, not inert like the AI ones above:
  // flipping this genuinely changes the theme immediately.
  darkMode: z.boolean(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
        notificationsEnabled: true,
        lowBandwidthMode: true,
        preferredLanguage: true,
        aiStudyBuddyEnabled: true,
        // M44 — read-only here, same reasoning as aiCreditBalance
        // below: managed through its own dedicated upload/remove
        // routes, never through a bare PUT to this settings endpoint.
        avatarUrl: true,
        // M45 — read-only from this route on purpose: a trainee can
        // see their own balance, but the only way it ever changes is
        // through a real AiCreditGrant row (an admin adjustment today,
        // an automatic subscription grant later) — never a bare PUT
        // to this settings endpoint, which would make it trivial to
        // just set your own balance to anything.
        aiCreditBalance: true,
        darkMode: true,
        // M43 — same "read-only here, managed through its own route"
        // reasoning as avatarUrl/aiCreditBalance above: the actual
        // opt-in/verify/opt-out routes own this state, this endpoint
        // just needs to display it.
        whatsappOptIn: true,
        whatsappVerifiedAt: true,
        phone: true,
      },
    });
    return NextResponse.json(trainee);
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = UpdateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const trainee = await prisma.trainee.update({
      where: { id: session.userId },
      data: {
        notificationsEnabled: parsed.data.notificationsEnabled,
        lowBandwidthMode: parsed.data.lowBandwidthMode,
        preferredLanguage: parsed.data.preferredLanguage,
        aiStudyBuddyEnabled: parsed.data.aiStudyBuddyEnabled,
        darkMode: parsed.data.darkMode,
      },
      select: {
        notificationsEnabled: true,
        lowBandwidthMode: true,
        preferredLanguage: true,
        aiStudyBuddyEnabled: true,
        aiCreditBalance: true,
        darkMode: true,
      },
    });
    return NextResponse.json(trainee);
  });
}

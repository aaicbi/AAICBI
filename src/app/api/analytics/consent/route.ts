import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { setConsentDecision, ensureVisitorId, clearConsentAndVisitorId } from "@/lib/analytics/visitorCookies";

const BodySchema = z.object({ decision: z.enum(["accepted", "declined"]) });

/**
 * POST /api/analytics/consent — the cookie-consent banner's one and
 * only action. Deliberately unauthenticated (anyone, logged in or not,
 * can call this — it's about a BROWSER's cookie consent, not an
 * account). Always records the decision; only ever creates the
 * `aaicbi_visitor_id` cookie when the decision is "accepted" — see
 * visitorCookies.ts's own comment on why this is the one and only place
 * that cookie gets created.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid decision is required." }, { status: 400 });
    }

    setConsentDecision(parsed.data.decision);
    if (parsed.data.decision === "accepted") {
      ensureVisitorId();
    }

    return NextResponse.json({ ok: true });
  });
}

/**
 * DELETE /api/analytics/consent — the "Manage Cookie Preferences"
 * withdrawal path (src/app/privacy-policy/page.tsx). Clears both
 * cookies entirely, same as never having decided — the banner
 * reappears, and no further VisitorEvent rows are written until a new
 * decision is made.
 */
export async function DELETE() {
  return withApiErrors(async () => {
    clearConsentAndVisitorId();
    return NextResponse.json({ ok: true });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { trackVisitorEvent, type VisitorEventType } from "@/lib/analytics/visitorTrack";

const BodySchema = z.object({
  type: z.enum(["PAGE_VIEWED", "COURSE_VIEWED", "REGISTER_CLICKED"]),
  path: z.string().max(500).optional(),
  courseId: z.string().max(100).optional(),
  // A hostname only, never a full URL — see visitorTrack.ts's own
  // comment on why the raw referrer URL never crosses the wire at all.
  referrerHostname: z.string().max(255).optional(),
  utmSource: z.string().max(100).optional(),
});

/**
 * POST /api/analytics/visitor-event — fired by the client-side tracking
 * helper (src/lib/analytics/visitorTrackClient.ts) on a public page
 * view/course view/register click. Deliberately unauthenticated (this
 * is for people who, by definition, may not be logged in at all) —
 * trackVisitorEvent itself is the real gate: it silently no-ops unless
 * the consent cookie is genuinely "accepted", so calling this with no
 * consent recorded is harmless, not a bypass of anything.
 *
 * Rate-limited per IP, generously — a real visitor browsing normally
 * never gets close to this, it only catches a scripted flood against an
 * unauthenticated public endpoint.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limited = await rateLimit(`visitor-event:${clientIp(req)}`, 60, 5 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ ok: false }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const recorded = await trackVisitorEvent({
      type: parsed.data.type as VisitorEventType,
      path: parsed.data.path,
      courseId: parsed.data.courseId,
      referrerHostname: parsed.data.referrerHostname,
      utmSource: parsed.data.utmSource,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: recorded });
  });
}

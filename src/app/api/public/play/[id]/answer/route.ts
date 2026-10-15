import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { VisitorPlayError, visitorAnswer } from "@/lib/quest/visitorPlay";

const Body = z.object({ playId: z.string().min(1).max(60), response: z.unknown() });

/** POST — grade one answer for a game that is open to visitors. No XP is paid; the answer is recorded for the Game results table. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to play.", signIn: true }, { status: 401 });
    const limit = await rateLimit(`visitor-play:${session.userId}:${clientIp(req)}`, 150, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of rounds. Please try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      return NextResponse.json(await visitorAnswer(params.id, parsed.data.playId, parsed.data.response, session));
    } catch (e) {
      if (e instanceof VisitorPlayError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { VisitorPlayError, visitorNext } from "@/lib/quest/visitorPlay";

const Body = z.object({ seen: z.array(z.string().max(60)).max(60).default([]) });

/** POST — serve the next item of a game that is open to visitors. Needs a signed-in account (any kind); the answer key is never sent. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to play.", signIn: true }, { status: 401 });
    const limit = await rateLimit(`visitor-play:${session.userId}:${clientIp(req)}`, 150, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of rounds. Please try again in a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      const next = await visitorNext(params.id, parsed.data.seen);
      return NextResponse.json(next ? { playId: next.itemId, format: next.format, objective: next.objective, served: next.served } : { done: true });
    } catch (e) {
      if (e instanceof VisitorPlayError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

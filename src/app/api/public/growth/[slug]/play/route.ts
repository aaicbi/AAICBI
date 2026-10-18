import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, playStart } from "@/lib/growth/growth";
import { SQUAD_JOINS_PER_HOUR } from "@/lib/growth/growthCore";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().max(80).nullish(), source: z.string().max(80).nullish(), duel: z.string().max(20).nullish(), squad: z.string().max(20).nullish(), rival: z.string().max(20).nullish(), nickname: z.string().max(60).nullish() });

/** POST — a newcomer starts the taster (or resumes it with the token their browser kept). No account. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-start:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of tries. Please wait a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    // One phone cannot pad a squad's total by joining over and over.
    if (parsed.data.squad && !parsed.data.token) {
      const joins = await rateLimit(`growth-squadjoin:${clientIp(req)}:${parsed.data.squad}`, SQUAD_JOINS_PER_HOUR, 60 * 60_000);
      if (!joins.allowed) return NextResponse.json({ error: "This device has joined that squad a lot already. Ask a friend to play on their own phone." }, { status: 429, headers: { "Retry-After": String(joins.retryAfterSeconds) } });
    }
    try {
      return NextResponse.json(await playStart(params.slug, parsed.data.token ?? null, parsed.data.source, { duel: parsed.data.duel, squad: parsed.data.squad, rival: parsed.data.rival, nickname: parsed.data.nickname }));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

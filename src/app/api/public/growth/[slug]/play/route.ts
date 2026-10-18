import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, playStart } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().max(80).nullish(), source: z.string().max(80).nullish(), duel: z.string().max(20).nullish(), nickname: z.string().max(60).nullish() });

/** POST — a newcomer starts the taster (or resumes it with the token their browser kept). No account. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-start:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of tries. Please wait a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      return NextResponse.json(await playStart(params.slug, parsed.data.token ?? null, parsed.data.source, { duel: parsed.data.duel, nickname: parsed.data.nickname }));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

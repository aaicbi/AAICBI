import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, createSquad } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(8).max(80), name: z.string().max(80), nickname: z.string().max(60).nullish() });

/** POST — someone who finished the taster starts a squad. Its members all play the same five questions and the squad's score is their total. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-squad:${clientIp(req)}`, 10, 60 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of squads. Please wait a while." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      return NextResponse.json(await createSquad(params.slug, parsed.data.token, parsed.data.name, parsed.data.nickname === null ? undefined : parsed.data.nickname));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

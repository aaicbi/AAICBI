import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, createChallenge } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(8).max(80), nickname: z.string().max(60).nullish() });

/** POST — a newcomer who finished the taster names their challenge (optional) and gets the link, text and card to share. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-challenge:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of tries. Please wait a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      // A missing nickname keeps the one already set; an empty one clears it.
      return NextResponse.json(await createChallenge(params.slug, parsed.data.token, parsed.data.nickname === undefined || parsed.data.nickname === null ? undefined : parsed.data.nickname));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

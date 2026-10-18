import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, saveLead } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(8).max(80), phone: z.string().max(30).nullish(), email: z.string().max(130).nullish(), consent: z.boolean() });

/** POST — a newcomer saves their score with a WhatsApp number or email and their consent to be contacted. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-save:${clientIp(req)}`, 20, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of tries. Please wait a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      return NextResponse.json(await saveLead(params.slug, parsed.data.token, parsed.data));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

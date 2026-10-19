import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, playAnswer } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(8).max(80), choice: z.string().min(1).max(40).optional(), timedOut: z.boolean().optional() }).refine((b) => b.timedOut === true || !!b.choice, "Choose one of the options.");

/** POST — grade the newcomer's answer to the question they are on. The answer key is only revealed after they answer. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-answer:${clientIp(req)}`, 240, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "That's a lot of answers. Please wait a few minutes." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      return NextResponse.json(await playAnswer(params.slug, parsed.data.token, parsed.data.choice, parsed.data.timedOut === true));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { GrowthError, claimPlay } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ slug: z.string().min(1).max(80), token: z.string().max(80).nullish() });

/** POST — a signed-in trainee continues from the taster: their play is linked to them and module 1 opens (the rest waits for payment). */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in to continue.", signIn: true }, { status: 401 });
    if (session.role !== "TRAINEE") return NextResponse.json({ error: "Module 1 is for trainee accounts. Create a trainee account to continue." }, { status: 403 });
    const limit = await rateLimit(`growth-claim:${session.userId}:${clientIp(req)}`, 20, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Please wait a few minutes and try again." }, { status: 429 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    try {
      return NextResponse.json(await claimPlay(session.userId, parsed.data.slug, parsed.data.token ?? null));
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { optOut } from "@/lib/growth/growth";

export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(8).max(80) });

/** POST — stop all contact for a saved score. The token is the private opt-out link we give with every contact. */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`growth-optout:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Please wait a few minutes and try again." }, { status: 429 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    return (await optOut(parsed.data.token)) ? NextResponse.json({ optedOut: true }) : NextResponse.json({ error: "That link isn't valid." }, { status: 404 });
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { optOutByToken } from "@/lib/crm/registration";

export const dynamic = "force-dynamic";

/** POST { token } — the private stop link in every CRM message. */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`crm-optout:${clientIp(req)}`, 30, 10 * 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Please wait a few minutes." }, { status: 429 });
    const parsed = z.object({ token: z.string().max(80) }).safeParse(await req.json().catch(() => ({})));
    if (!parsed.success || !(await optOutByToken(parsed.data.token))) return NextResponse.json({ error: "That link isn't valid." }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}

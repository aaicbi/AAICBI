import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { respondToInvite } from "@/lib/startups/startups";
import { memberSession, startupFailure } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** POST { accept } — the invited member accepts or declines. Nobody joins a team without saying yes. */
export async function POST(req: NextRequest, { params }: { params: { memberId: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const parsed = z.object({ accept: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      await respondToInvite(params.memberId, session.userId, parsed.data.accept);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { createStartup } from "@/lib/startups/startups";
import { StartupInputSchema } from "@/lib/startups/startupCore";
import { memberSession, startupFailure } from "@/lib/startups/http";
import { ensureProfile } from "@/lib/profiles/profiles";

export const dynamic = "force-dynamic";

/** POST /api/startups — a member founds a startup (a draft, private until a super admin approves it). */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const parsed = StartupInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    try {
      const s = await createStartup(session.userId, parsed.data);
      const p = await ensureProfile("STARTUP", s.id);
      return NextResponse.json({ id: s.id, handle: p?.handle ?? null }, { status: 201 });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

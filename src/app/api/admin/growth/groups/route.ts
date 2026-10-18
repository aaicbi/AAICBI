import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { GrowthError } from "@/lib/growth/growth";
import { campaignChoices, challengesList, clearNickname, groupsSummary, removeSquad, renameSquad, squadsList } from "@/lib/growth/groups";

export const dynamic = "force-dynamic";

/** GET ?kind=squads|challenges&campaign=&q=&page= — the squads or the friend challenges, newest first, with headline numbers. Super Admin only. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const p = req.nextUrl.searchParams;
    const filter = { campaignId: p.get("campaign") || undefined, q: p.get("q") || undefined, page: Number(p.get("page")) || 1 };
    const kind = p.get("kind") === "challenges" ? "challenges" : "squads";
    const [summary, campaigns, list] = await Promise.all([groupsSummary(filter.campaignId), campaignChoices(), kind === "squads" ? squadsList(filter) : challengesList(filter)]);
    return NextResponse.json({ kind, summary, campaigns, ...list });
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), squadId: z.string().min(1).max(60), name: z.string().max(60) }),
  z.object({ action: z.literal("remove"), squadId: z.string().min(1).max(60) }),
  z.object({ action: z.literal("clearName"), playId: z.string().min(1).max(60) }),
]);

/** POST — rename or remove a squad, or clear a nickname. Super Admin only; every change is logged. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      if (b.action === "rename") await renameSquad(s.userId, b.squadId, b.name);
      else if (b.action === "remove") await removeSquad(s.userId, b.squadId);
      else await clearNickname(s.userId, b.playId);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof GrowthError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

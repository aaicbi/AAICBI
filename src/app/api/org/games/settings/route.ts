import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { orgCtx, settings, updateSettings } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET: which games are on for each of the organization's courses, and which settings the Super Admin lets it change. */
export async function GET() {
  return orgGamesApi(async () => NextResponse.json(await settings(await orgCtx("org_games.results:view")), { headers: noStore }));
}

const Body = z.object({ courseId: z.string().min(1).max(80), switches: z.record(z.unknown()).optional(), rules: z.record(z.unknown()).optional() });

/** PUT: switch a supported game on or off for one course (only where the platform allows it), or set its participation rules. Only what the Super Admin allowed. */
export async function PUT(req: NextRequest) {
  return orgGamesApi(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    const ctx = await orgCtx("org_games.settings:configure");
    await updateSettings(ctx, parsed.data);
    return NextResponse.json(await settings(ctx), { headers: noStore });
  });
}

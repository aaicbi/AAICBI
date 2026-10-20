import { NextResponse } from "next/server";
import { live, orgCtx } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET: games being played, waiting or paused among the organization's own trainees, with flags (possibly abandoned, open reports). */
export async function GET() {
  return orgGamesApi(async () => NextResponse.json({ matches: await live(await orgCtx("org_games.live:view")) }, { headers: noStore }));
}

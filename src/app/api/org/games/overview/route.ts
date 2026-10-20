import { NextResponse } from "next/server";
import { orgCtx, overview } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET: the organization's courses, cohorts, games and headline numbers, and what this person may do. Only its own. */
export async function GET() {
  return orgGamesApi(async () => NextResponse.json(await overview(await orgCtx("org_games.results:view")), { headers: noStore }));
}

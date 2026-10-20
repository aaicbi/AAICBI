import { NextRequest, NextResponse } from "next/server";
import { leaderboard, orgCtx } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET ?courseId — the ladder and the Fastest Fingers credit leaders of one of the organization's courses. */
export async function GET(req: NextRequest) {
  return orgGamesApi(async () => {
    const ctx = await orgCtx("org_games.results:view");
    return NextResponse.json(await leaderboard(ctx, (req.nextUrl.searchParams.get("courseId") ?? "").slice(0, 80)), { headers: noStore });
  });
}

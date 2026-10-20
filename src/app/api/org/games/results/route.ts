import { NextRequest, NextResponse } from "next/server";
import { orgCtx, results } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET ?courseId&gameId&cohortId&q&days — game results of the organization's own trainees, one row per person. */
export async function GET(req: NextRequest) {
  return orgGamesApi(async () => {
    const ctx = await orgCtx("org_games.results:view");
    const q = req.nextUrl.searchParams;
    const days = Number(q.get("days"));
    return NextResponse.json(await results(ctx, { courseId: q.get("courseId") || null, gameId: q.get("gameId") || null, cohortId: q.get("cohortId") || null, traineeQuery: q.get("q") ?? "", days: [7, 30, 90].includes(days) ? days : null }), { headers: noStore });
  });
}

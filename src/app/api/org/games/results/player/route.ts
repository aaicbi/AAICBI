import { NextRequest, NextResponse } from "next/server";
import { orgCtx, playerHistory } from "@/lib/orggames/orgGames";
import { noStore, orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET ?traineeId — one of the organization's trainees: their latest answers and performance history. */
export async function GET(req: NextRequest) {
  return orgGamesApi(async () => {
    const ctx = await orgCtx("org_games.results:view");
    const id = req.nextUrl.searchParams.get("traineeId") ?? "";
    return NextResponse.json({ plays: await playerHistory(ctx, id.slice(0, 80)) }, { headers: noStore });
  });
}

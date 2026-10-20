import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { recordAudit } from "@/lib/rbac/audit";
import { orgCtx, results } from "@/lib/orggames/orgGames";
import { RESULT_CSV_HEAD } from "@/lib/orggames/core";
import { orgGamesApi } from "@/lib/orggames/http";

export const dynamic = "force-dynamic";

/** GET — download the filtered results as a spreadsheet. Needs the export permission (a Super Admin switches it on for the organization); recorded. */
export async function GET(req: NextRequest) {
  return orgGamesApi(async () => {
    const ctx = await orgCtx("org_games.results:export");
    const q = req.nextUrl.searchParams;
    const days = Number(q.get("days"));
    const { players } = await results(ctx, { courseId: q.get("courseId") || null, gameId: q.get("gameId") || null, cohortId: q.get("cohortId") || null, traineeQuery: q.get("q") ?? "", days: [7, 30, 90].includes(days) ? days : null });
    await recordAudit({ actorId: ctx.session.userId, actorRole: "ORGANIZATION", action: "GAME_RESULTS_EXPORTED", resourceType: "game_results", organizationId: ctx.organizationId, after: { rows: players.length } });
    const csv = toCsv(RESULT_CSV_HEAD, players.map((p) => [p.name, p.email, p.sources.map((x) => (x === "FEED" ? "Feed" : "Course")).join(" + "), p.games, p.answers, p.correct, p.accuracy, p.averageScore]));
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="game-results.csv"', "Cache-Control": "no-store" } });
  });
}

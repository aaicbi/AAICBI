import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { toCsv } from "@/lib/csv";
import { ResultsError, gameOptions, playerTable, requireResultsViewer, resultsShared } from "@/lib/quest/results";
import { PLAYER_KIND_LABEL } from "@/lib/quest/resultsCore";

/** GET: the Game results table (one row per player) for the period and game chosen. `format=csv` downloads it. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    try {
      const s = await requireResultsViewer();
      const sp = req.nextUrl.searchParams;
      const days = Number(sp.get("days"));
      const query = { days: [7, 30, 90].includes(days) ? days : null, gameId: sp.get("gameId") || null, q: (sp.get("q") ?? "").slice(0, 80) };
      const { players, summary } = await playerTable(s, query);
      if (sp.get("format") === "csv") {
        const csv = toCsv(
          ["Name", "Email", "Account", "Where", "Games", "Answers", "Correct", "Accuracy %", "Average score %", "Quiz accuracy %", "Matching accuracy %", "Ordering accuracy %", "Scenario accuracy %", "First played", "Last played"],
          players.map((p) => {
            const f = (k: "QUIZ" | "MATCHING" | "ORDERING" | "SCENARIO") => (p.byFormat[k].answers ? Math.round((p.byFormat[k].correct / p.byFormat[k].answers) * 100) : "");
            return [p.name, p.email, PLAYER_KIND_LABEL[p.kind] ?? p.kind, p.sources.map((x) => (x === "FEED" ? "Feed" : "Course")).join(" + "), p.games, p.answers, p.correct, p.accuracy, p.averageScore, f("QUIZ"), f("MATCHING"), f("ORDERING"), f("SCENARIO"), p.first, p.last];
          })
        );
        return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="game-results.csv"' } });
      }
      return NextResponse.json({ players, summary, games: await gameOptions(s), isSuper: s.isSuper, shared: await resultsShared() });
    } catch (e) {
      if (e instanceof ResultsError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

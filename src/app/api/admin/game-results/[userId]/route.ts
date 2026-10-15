import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { ResultsError, playerDetail, requireResultsViewer } from "@/lib/quest/results";

/** GET: one player's latest answers (newest first), limited to what this viewer may see. */
export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  return withApiErrors(async () => {
    try {
      const s = await requireResultsViewer();
      return NextResponse.json({ plays: await playerDetail(s, params.userId) });
    } catch (e) {
      if (e instanceof ResultsError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireReviewer } from "@/lib/review/access";
import { buildQueue } from "@/lib/review/queue";
import { parseFilter } from "@/lib/review/reviewCore";

export const dynamic = "force-dynamic";

/** GET ?filter=all|posts|loop|appeals|escalated — the review team's inbox: everything waiting, escalated items first, then the longest waiting. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const me = await requireReviewer();
    const result = await buildQueue(parseFilter(req.nextUrl.searchParams.get("filter")));
    return NextResponse.json({ ...result, me: { name: me.name, isSuperAdmin: me.isSuperAdmin } });
  });
}

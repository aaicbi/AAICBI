import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { approvedBrief } from "@/lib/changeRequests/server";

/** GET: the approved requests as one Markdown brief for Claude Code. `?download=1` sends it as a file. Super Admin only. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const { markdown, count } = await approvedBrief();
    if (req.nextUrl.searchParams.get("download")) {
      return new NextResponse(markdown, { headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="approved-change-requests.md"' } });
    }
    return NextResponse.json({ count, markdown });
  });
}

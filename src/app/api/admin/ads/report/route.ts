import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { adsReport } from "@/lib/ads/ads";
import { cleanPeriod, toCsv } from "@/lib/ads/adsCore";

export const dynamic = "force-dynamic";

/**
 * GET ?period=7d|30d|all&org=<id> — views, taps and tap rate for each ad. Super Admin sees every ad (and may pick an organization);
 * an organization sees only its own ads. `?format=csv` returns a spreadsheet.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const q = req.nextUrl.searchParams;
    const period = cleanPeriod(q.get("period"));
    const org = q.get("org");
    const report = await adsReport({ userId: s.userId, role: s.role }, { period, organizationId: org && org !== "all" ? org : null });
    if (q.get("format") === "csv") {
      const csv = toCsv(
        ["Ad", "Advertiser", "Status", "Starts", "Ends", "Views", "Taps", "Tap rate (%)"],
        report.ads.map((a) => [a.headline, a.advertiserName, a.status, a.startsOn, a.endsOn, a.views, a.taps, a.tapRate]),
      );
      return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ads-report-${period}.csv"`, "Cache-Control": "no-store" } });
    }
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { ReportError, campaignReport, ledgerForCsv } from "@/lib/growth/report";
import { cleanPeriod, toCsv } from "@/lib/growth/reportCore";

export const dynamic = "force-dynamic";

/** `org=all` (every campaign), `org=aaicbi` (AAICBI's own courses) or an organization id. Only a Super Admin can choose; anyone else sees only their own courses. */
function scopeFrom(raw: string | null) {
  if (!raw || raw === "all") return {};
  if (raw === "aaicbi") return { organizationId: null };
  return { organizationId: raw };
}

/**
 * GET — the campaign report: how many people went from the taster to a payment, where they came from, and the commission ledger.
 * Super Admin sees everything and can pick an organization; an organization (or any other staff member) sees only its own courses.
 * `?format=csv` returns the ledger as a spreadsheet.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const q = req.nextUrl.searchParams;
    const period = cleanPeriod(q.get("period"));
    const choice = scopeFrom(q.get("org"));
    try {
      if (q.get("format") === "csv") {
        const rows = await ledgerForCsv(s, choice, period);
        const csv = toCsv(
          ["Paid on", "Organization", "Course", "Trainee", "Source", "Payment (NGN)", "Rate (%)", "Commission (NGN)", "Status", "Note", "Payment reference"],
          rows.map((r) => [r.paidAt, r.organization, r.course, r.trainee, r.source, r.amountNaira, r.ratePercent, r.commissionNaira, r.status, r.note, r.reference]),
        );
        return new NextResponse(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="growth-commissions-${period}.csv"`, "Cache-Control": "no-store" } });
      }
      return NextResponse.json(await campaignReport(s, choice, period));
    } catch (e) {
      if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

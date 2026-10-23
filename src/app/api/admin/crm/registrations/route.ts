import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { recordAudit } from "@/lib/rbac/audit";
import { exportCsv, listRegistrations, requireCrm, type ListFilters } from "@/lib/crm/staff";

export const dynamic = "force-dynamic";

function filtersOf(sp: URLSearchParams): ListFilters {
  return {
    q: sp.get("q")?.slice(0, 80) || undefined, courseId: sp.get("courseId") || undefined, stage: sp.get("stage") || undefined, source: sp.get("source") || undefined,
    needsFollowUp: sp.get("needsFollowUp") === "1", page: Number(sp.get("page")) || 1,
  };
}

/** GET — registrations this person may see. `?format=csv` downloads them (needs the export permission). */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const sp = req.nextUrl.searchParams;
    if (sp.get("format") === "csv") {
      const { session, access, canContacts } = await requireCrm("export");
      const csv = await exportCsv(access, canContacts, filtersOf(sp));
      await recordAudit({ actorId: session.userId, actorRole: access.kind === "organization" ? "ORGANIZATION" : session.role, action: "CRM_EXPORT", resourceType: "registrations", organizationId: access.organizationId });
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="registrations.csv"', "Cache-Control": "no-store" } });
    }
    const { access, canContacts } = await requireCrm("view");
    return NextResponse.json(await listRegistrations(access, canContacts, filtersOf(sp)));
  });
}

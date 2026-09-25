import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/reports — every profile report, newest first, with
 * the reported account's current display name resolved for
 * convenience (a report row only stores a polymorphic type+id, same
 * as ProfileReport's own schema comment explains).
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");

    const reports = await prisma.profileReport.findMany({
      orderBy: { createdAt: "desc" },
      include: { reviewedBy: { select: { name: true } } },
    });

    const traineeIds = reports.filter((r: (typeof reports)[number]) => r.reportedType === "TRAINEE").map((r: (typeof reports)[number]) => r.reportedId);
    const employerIds = reports.filter((r: (typeof reports)[number]) => r.reportedType === "EMPLOYER").map((r: (typeof reports)[number]) => r.reportedId);
    const staffIds = reports.filter((r: (typeof reports)[number]) => r.reportedType === "STAFF").map((r: (typeof reports)[number]) => r.reportedId);

    const [trainees, employers, staff] = await Promise.all([
      prisma.trainee.findMany({ where: { id: { in: traineeIds } }, select: { id: true, name: true } }),
      prisma.employer.findMany({ where: { id: { in: employerIds } }, select: { id: true, companyName: true } }),
      prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }),
    ]);
    const traineeNames = new Map(trainees.map((t: { id: string; name: string }) => [t.id, t.name]));
    const employerNames = new Map(employers.map((e: { id: string; companyName: string }) => [e.id, e.companyName]));
    const staffNames = new Map(staff.map((s: { id: string; name: string }) => [s.id, s.name]));

    function resolveReportedName(r: (typeof reports)[number]): string {
      if (r.reportedType === "TRAINEE") return traineeNames.get(r.reportedId) ?? "(deleted)";
      if (r.reportedType === "STAFF") return staffNames.get(r.reportedId) ?? "(deleted)";
      return employerNames.get(r.reportedId) ?? "(deleted)";
    }

    return NextResponse.json(
      reports.map((r: (typeof reports)[number]) => ({
        id: r.id,
        reporterType: r.reporterType,
        reportedType: r.reportedType,
        reportedId: r.reportedId,
        reportedName: resolveReportedName(r),
        reason: r.reason,
        details: r.details,
        contextType: r.contextType,
        contextId: r.contextId,
        status: r.status,
        reviewedByName: r.reviewedBy?.name ?? null,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
      }))
    );
  });
}

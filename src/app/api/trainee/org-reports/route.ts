import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rateLimit";
import { traineeOrganizations } from "@/lib/ecosystem/orgScope";
import { OrgReportSchema, REPORT_CATEGORIES } from "@/lib/ecosystem/videoSubmissionCore";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/trainee/org-reports — a trainee tells SUPER_ADMIN about
 * harm done to them by a training organization. The report is confidential:
 * nothing here, and no organization-facing route, ever reveals who sent it.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const [reports, orgs] = await Promise.all([
      prisma.organizationReport.findMany({
        where: { traineeId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, category: true, status: true, createdAt: true, trainingOrganization: { select: { name: true } } },
      }),
      traineeOrganizations(session.userId),
    ]);
    return NextResponse.json({
      organizations: orgs.map((o) => ({ id: o.id, name: o.name })),
      categories: REPORT_CATEGORIES,
      reports: reports.map(({ trainingOrganization, ...r }) => ({ ...r, organizationName: trainingOrganization.name })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const limited = await rateLimit(`trainee-org-report:${session.userId}`, 5, 24 * 60 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "You have sent several reports today. Please try again tomorrow, or message the Super Admin from Settings." }, { status: 429 });
    const parsed = OrgReportSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });

    const org = (await traineeOrganizations(session.userId)).find((o) => o.id === parsed.data.trainingOrganizationId);
    if (!org) return NextResponse.json({ error: "You can only report an organization whose course you are enrolled in." }, { status: 403 });

    const report = await prisma.organizationReport.create({
      data: { traineeId: session.userId, trainingOrganizationId: org.id, category: parsed.data.category, details: parsed.data.details },
      select: { id: true },
    });
    return NextResponse.json({ id: report.id }, { status: 201 });
  });
}

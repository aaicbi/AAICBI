import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { sendPushForNotification } from "@/lib/push/send";
import { ReportActionSchema, reportStatusForAction } from "@/lib/ecosystem/videoSubmissionCore";

/** POST /api/admin/ecosystem/reports/[id] — SUPER_ADMIN moves a trainee's report about an organization along. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = ReportActionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const report = await prisma.organizationReport.findUnique({ where: { id: params.id }, select: { id: true, traineeId: true } });
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const status = reportStatusForAction(parsed.data.action);
    await prisma.organizationReport.update({
      where: { id: report.id },
      data: {
        status,
        adminNote: parsed.data.note || null,
        handledById: session.userId,
        resolvedAt: status === "IN_REVIEW" ? null : new Date(),
      },
    });
    if (status !== "IN_REVIEW") {
      const note = {
        type: "ORG_REPORT_UPDATE",
        title: "Update on your report",
        body: status === "RESOLVED" ? "AAICBI has reviewed and acted on your report." : "AAICBI has reviewed your report and closed it.",
        url: "/trainee/report",
      };
      await prisma.userNotification.create({ data: { recipientType: "TRAINEE", recipientId: report.traineeId, ...note } });
      await sendPushForNotification("TRAINEE", report.traineeId, note);
    }
    return NextResponse.json({ status });
  });
}

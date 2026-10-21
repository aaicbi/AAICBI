import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { recordAudit } from "@/lib/rbac/audit";
import { sendEmail } from "@/lib/notifications/email";
import { performanceReportEmail } from "@/lib/notifications/templates";
import { rosterCourseIds, scopeForTrainee } from "@/lib/reports/access";
import { getRoster, getTraineeReport } from "@/lib/reports/performance";
import { parseRecipients } from "@/lib/reports/performanceCore";
import { renderRosterPdf, renderTraineePdf } from "@/lib/reports/reportPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ traineeId: z.string().min(1).optional(), courseId: z.string().min(1).optional(), q: z.string().max(80).optional(), to: z.string().min(3).max(1000), message: z.string().max(2000).optional() });

/**
 * POST /api/reports/trainees/send: emails a performance report as a PDF to the addresses given (at most 5), with the sender's own message.
 * With `traineeId` it is that trainee's full report; without, the roster summary of the sender's trainees.
 */
export async function POST(req: Request) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Please give at least one email address." }, { status: 400 });
    const b = parsed.data;
    const rec = parseRecipients(b.to);
    if (!rec.ok.length || rec.bad.length) return NextResponse.json({ error: rec.bad.length ? `These are not valid email addresses: ${rec.bad.slice(0, 3).join(", ")}` : "Please give at least one email address." }, { status: 400 });
    if (rec.tooMany) return NextResponse.json({ error: "You can send to at most 5 addresses at a time." }, { status: 400 });
    const rl = await rateLimit(`report-send:${session.userId}`, 20, 60 * 60 * 1000);
    if (!rl.allowed) return NextResponse.json({ error: "You have sent many reports in the last hour. Please try again later." }, { status: 429 });

    const sender = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    const from = sender?.name ?? "AAICBI staff";
    let pdf: Buffer, label: string, filename: string, resource: string;
    if (b.traineeId) {
      const scope = await scopeForTrainee(session, b.traineeId);
      const report = scope ? await getTraineeReport(b.traineeId, scope) : null;
      if (!report) return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
      pdf = await renderTraineePdf(report, { message: b.message, from });
      label = report.trainee.name; filename = `performance-${report.trainee.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`; resource = b.traineeId;
    } else {
      const ids = await rosterCourseIds(session, b.courseId);
      if (!ids) return NextResponse.json({ error: "Course not found." }, { status: 404 });
      const { rows } = await getRoster(ids, (b.q ?? "").trim());
      if (!rows.length) return NextResponse.json({ error: "There are no trainees to report on." }, { status: 400 });
      pdf = await renderRosterPdf("Trainee performance", rows, { message: b.message, from });
      label = `${rows.length} trainees`; filename = "trainee-performance.pdf"; resource = "roster";
    }

    const mail = performanceReportEmail({ senderName: from, subjectLabel: label, message: b.message ?? "", filename });
    const failed: string[] = [];
    for (const to of rec.ok) { const r = await sendEmail({ to, ...mail, attachments: [{ filename, content: pdf }] }); if (!r.ok) failed.push(to); }
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "PERFORMANCE_REPORT_SENT", resourceType: "trainee_report", resourceId: resource, outcome: failed.length === rec.ok.length ? "FAILED" : "OK", reason: `${rec.ok.length - failed.length} of ${rec.ok.length} sent` });
    if (failed.length === rec.ok.length) return NextResponse.json({ error: "The email could not be sent. Check that email sending is set up, then try again." }, { status: 502 });
    return NextResponse.json({ sent: rec.ok.length - failed.length, failed });
  });
}

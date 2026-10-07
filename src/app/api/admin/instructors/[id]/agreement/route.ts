import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { instructorAgreementSentEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { renderInstructorAgreementPdf } from "@/lib/instructorAgreementPdf";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

const SendAgreementSchema = z.object({
  templateId: z.string().min(1),
  monthlyCompensationKobo: z.number().int().nonnegative().optional(),
  paymentFrequency: z.string().trim().max(60).optional(),
  paymentDate: z.string().trim().max(120).optional(),
  noticePeriodDays: z.number().int().positive().default(30),
  effectiveDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  // The remaining blanks from the real AAICBI Instructor Letter of
  // Engagement — see instructorAgreementTemplate.ts's own comment for
  // why these live on the agreement row rather than on User.
  instructorAddress: z.string().trim().max(300).optional(),
  instructorPhone: z.string().trim().max(40).optional(),
  position: z.string().trim().max(60).optional(),
  courseDuration: z.string().trim().max(60).optional(),
  liveSessionDay: z.string().trim().max(40).optional(),
  liveSessionTime: z.string().trim().max(40).optional(),
  liveSessionPlatform: z.string().trim().max(60).optional(),
});

function resolveTemplate(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((text, [key, value]) => text.split(`{{${key}}}`).join(value), content);
}

/**
 * POST /api/admin/instructors/[id]/agreement — resolves an
 * AgreementTemplate's {{VARIABLE}} placeholders into a full, immutable
 * content snapshot and creates a new PENDING InstructorAgreement. The
 * resolved snapshot is what's stored and shown to the instructor —
 * never a live reference back to the template — so a later template
 * edit can never retroactively change something already sent or
 * signed (spec Section 28's own requirement).
 *
 * Security audit finding (severe) — this let any plain "ADMIN" session
 * issue a formal, PDF "Letter of Engagement" (compensation, payment
 * schedule, effective dates) to ANY real instructor, including from a
 * training organization's own shadow session. Blocked the same way as
 * every other /api/admin/instructors/** route.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const instructor = await prisma.user.findUnique({
      where: { id: params.id, role: "INSTRUCTOR" },
      select: { id: true, name: true, email: true, courses: { select: { title: true } } },
    });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = SendAgreementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const template = await prisma.agreementTemplate.findUnique({ where: { id: parsed.data.templateId } });
    if (!template || !template.isActive) {
      return NextResponse.json({ error: "That template is not available." }, { status: 400 });
    }

    const sender = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    const effectiveDate = new Date(parsed.data.effectiveDate);
    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
    const letterDate = new Date();
    const courseName = instructor.courses.map((c) => c.title).join(", ") || "Not yet assigned";
    const content = resolveTemplate(template.content, {
      LETTER_DATE: letterDate.toLocaleDateString(),
      INSTRUCTOR_NAME: instructor.name,
      INSTRUCTOR_EMAIL: instructor.email,
      INSTRUCTOR_ADDRESS: parsed.data.instructorAddress || "Not provided",
      INSTRUCTOR_PHONE: parsed.data.instructorPhone || "Not provided",
      POSITION: parsed.data.position || "Instructor",
      COURSE_NAME: courseName,
      COURSE_DURATION: parsed.data.courseDuration || "Not specified",
      START_DATE: effectiveDate.toLocaleDateString(),
      END_DATE: endDate ? endDate.toLocaleDateString() : "Not specified",
      EFFECTIVE_DATE: effectiveDate.toLocaleDateString(),
      REMUNERATION_AMOUNT:
        parsed.data.monthlyCompensationKobo != null
          ? `₦${(parsed.data.monthlyCompensationKobo / 100).toLocaleString()} (One Hundred Thousand Naira and equivalents shown in figures above)`
          : "To be confirmed",
      MONTHLY_COMPENSATION:
        parsed.data.monthlyCompensationKobo != null ? `₦${(parsed.data.monthlyCompensationKobo / 100).toLocaleString()}` : "To be confirmed",
      PAYMENT_SCHEDULE: parsed.data.paymentFrequency ?? "Monthly",
      PAYMENT_FREQUENCY: parsed.data.paymentFrequency ?? "Monthly",
      PAYMENT_DATE: parsed.data.paymentDate || "As agreed",
      LIVE_SESSION_DAY: parsed.data.liveSessionDay || "To be confirmed",
      LIVE_SESSION_TIME: parsed.data.liveSessionTime || "To be confirmed",
      LIVE_SESSION_PLATFORM: parsed.data.liveSessionPlatform || "To be confirmed",
      NOTICE_PERIOD: `${parsed.data.noticePeriodDays} days`,
      SUPERVISOR_NAME: sender?.name ?? "AAICBI",
    });

    const agreement = await prisma.instructorAgreement.create({
      data: {
        instructorId: instructor.id,
        templateId: template.id,
        templateVersion: template.version,
        content,
        monthlyCompensationKobo: parsed.data.monthlyCompensationKobo,
        paymentFrequency: parsed.data.paymentFrequency,
        paymentDate: parsed.data.paymentDate,
        noticePeriodDays: parsed.data.noticePeriodDays,
        effectiveDate,
        endDate,
        instructorAddress: parsed.data.instructorAddress,
        instructorPhone: parsed.data.instructorPhone,
        position: parsed.data.position,
        courseDuration: parsed.data.courseDuration,
        liveSessionDay: parsed.data.liveSessionDay,
        liveSessionTime: parsed.data.liveSessionTime,
        liveSessionPlatform: parsed.data.liveSessionPlatform,
        sentById: session.userId,
      },
    });

    // A branded PDF copy of the exact resolved letter, signed by the
    // CEO — see instructorAgreementPdf.tsx's own comment. Rendered in
    // its own try/catch so a PDF-generation failure degrades to "the
    // email still goes out, just without the attachment," never to "no
    // email at all" — the in-app archive already has the full text
    // regardless (see /admin/instructors/[id]'s agreement history).
    //
    // pdfAttachmentError is diagnostic-only (see its own schema
    // comment): a deployed environment's console output isn't
    // reachable after the fact, so both the failure AND the success
    // case are recorded directly onto the row, readable straight from
    // the database instead of guessed at.
    let pdfAttachment: { filename: string; content: Buffer }[] | undefined;
    let pdfDiagnostic: string;
    try {
      const pdf = await renderInstructorAgreementPdf({ instructorName: instructor.name, content, sentAt: letterDate });
      pdfAttachment = [{ filename: `AAICBI-Letter-of-Engagement-${instructor.name.replace(/\s+/g, "-")}.pdf`, content: pdf }];
      pdfDiagnostic = `OK: generated ${pdf.length} bytes`;
    } catch (e) {
      pdfDiagnostic = `FAILED: ${e instanceof Error ? e.stack || e.message : String(e)}`;
      console.error(`Agreement PDF generation failed for agreement (instructor ${instructor.id}):`, e);
    }
    await prisma.instructorAgreement.update({ where: { id: agreement.id }, data: { pdfAttachmentError: pdfDiagnostic } }).catch(() => {});

    try {
      const emailContent = instructorAgreementSentEmail(instructor.name, appUrl("/instructor/agreement"));
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: instructor.id,
        to: instructor.email,
        type: "INSTRUCTOR_AGREEMENT_SENT",
        relatedId: agreement.id,
        url: "/instructor/agreement",
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments: pdfAttachment,
      });
    } catch (e) {
      console.error(`Instructor agreement notification failed for agreement ${agreement.id}:`, e);
    }

    return NextResponse.json(agreement, { status: 201 });
  });
}

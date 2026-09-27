import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { examAccessGrantedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const GrantSchema = z.object({ email: z.string().email() });

/**
 * GET/POST /api/exams/[id]/access — who can see/start this standalone
 * exam. SUPER_ADMIN only, a deliberately narrower boundary than most
 * exam routes (which also allow the exam's own ADMIN/INSTRUCTOR
 * creator) — deciding who gets to attempt an applicant-screening exam
 * was explicitly scoped to Super Admin alone. Only meaningful for a
 * standalone exam (no courseId, no moduleId); a module assessment or
 * course examination is already gated by course enrollment, and this
 * route refuses to touch either.
 */
const NOT_STANDALONE_ERROR = "This exam is part of a course; manage access via that course's enrollments instead.";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { courseId: true, moduleId: true } });
    if (!exam) {
      return NextResponse.json({ error: "Examination not found." }, { status: 404 });
    }
    if (exam.courseId || exam.moduleId) {
      return NextResponse.json({ error: NOT_STANDALONE_ERROR }, { status: 400 });
    }

    const grants = await prisma.examAccessGrant.findMany({
      where: { examId: params.id },
      orderBy: { grantedAt: "desc" },
      include: { trainee: { select: { id: true, name: true, email: true } }, grantedBy: { select: { name: true } } },
    });
    return NextResponse.json(grants);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { id: true, title: true, code: true, courseId: true, moduleId: true } });
    if (!exam) {
      return NextResponse.json({ error: "Examination not found." }, { status: 404 });
    }
    if (exam.courseId || exam.moduleId) {
      return NextResponse.json({ error: NOT_STANDALONE_ERROR }, { status: 400 });
    }

    const body = await req.json();
    const parsed = GrantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const trainee = await prisma.trainee.findUnique({ where: { email: parsed.data.email } });
    if (!trainee) {
      return NextResponse.json({ error: "No trainee account found with that email." }, { status: 404 });
    }

    const existing = await prisma.examAccessGrant.findUnique({
      where: { examId_traineeId: { examId: exam.id, traineeId: trainee.id } },
    });

    let grant;
    if (existing) {
      if (existing.revokedAt === null) {
        return NextResponse.json({ error: "This trainee already has access to this examination." }, { status: 409 });
      }
      // A previously-revoked trainee — re-granting is a deliberate
      // staff action, same reasoning as the course-enrollment grant
      // route's own re-activation branch.
      grant = await prisma.examAccessGrant.update({
        where: { id: existing.id },
        data: { grantedById: session.userId, grantedAt: new Date(), revokedAt: null },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      });
    } else {
      grant = await prisma.examAccessGrant.create({
        data: { examId: exam.id, traineeId: trainee.id, grantedById: session.userId },
        include: { trainee: { select: { id: true, name: true, email: true } } },
      });
    }

    try {
      const examUrl = `/exam/${exam.code}`;
      const emailContent = examAccessGrantedEmail(trainee.name, exam.title, appUrl(examUrl));
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: trainee.id,
        to: trainee.email,
        type: "EXAM_ACCESS_GRANTED",
        relatedId: exam.id,
        url: examUrl,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    } catch (e) {
      console.error(`Exam access grant notification failed for exam ${exam.id}:`, e);
    }

    return NextResponse.json(grant, { status: existing ? 200 : 201 });
  });
}

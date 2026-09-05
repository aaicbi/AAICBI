import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hasCourseAccess } from "@/lib/courseAccess";
import { getModuleLockStatus } from "@/lib/progress";
import { getTraineeCohortForCourse, qaThreadVisibilityFilter } from "@/lib/qaScope";

const CreateThreadSchema = z.object({
  title: z.string().trim().min(3),
  content: z.string().trim().min(1),
});

/**
 * GET/POST /api/lessons/[id]/qa/threads — M41's actual Q&A entry
 * point. Same access gate as viewing the lesson itself (enrollment +
 * module unlock), the same reasoning M40's download route already
 * established for this exact pattern: a feature scoped to lesson
 * content has to respect the same rules as the content it's attached
 * to, not a separately-invented check.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        module: { select: { id: true, courseId: true, course: { select: { published: true, qaScope: true } } } },
      },
    });
    if (!lesson || !lesson.module.course.published) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }
    const courseId = lesson.module.courseId;
    if (!(await hasCourseAccess(session.userId, courseId))) {
      return NextResponse.json({ error: "You're not enrolled in this course yet." }, { status: 403 });
    }
    const lockStatus = await getModuleLockStatus(courseId, lesson.module.id, session.userId);
    if (!lockStatus?.unlocked) {
      return NextResponse.json({ error: "This module isn't unlocked yet." }, { status: 403 });
    }

    // Reading stays available even while suspended — the roadmap's
    // own explicit constraint — so no qaSuspendedAt check here at all,
    // only on the POST branch below.
    const traineeCohortId = await getTraineeCohortForCourse(session.userId, courseId);
    const threads = await prisma.qaThread.findMany({
      where: { lessonId: params.id, ...qaThreadVisibilityFilter(traineeCohortId) },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
    });
    return NextResponse.json(threads);
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: { qaSuspendedAt: true },
    });
    if (trainee.qaSuspendedAt) {
      return NextResponse.json(
        { error: "Your Q&A posting access is currently suspended. You can still read existing threads." },
        { status: 403 }
      );
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        module: { select: { id: true, courseId: true, course: { select: { published: true, qaScope: true } } } },
      },
    });
    if (!lesson || !lesson.module.course.published) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }
    const courseId = lesson.module.courseId;
    if (!(await hasCourseAccess(session.userId, courseId))) {
      return NextResponse.json({ error: "You're not enrolled in this course yet." }, { status: 403 });
    }
    const lockStatus = await getModuleLockStatus(courseId, lesson.module.id, session.userId);
    if (!lockStatus?.unlocked) {
      return NextResponse.json({ error: "This module isn't unlocked yet." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateThreadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // A real, deliberate design decision, not an oversight: under a
    // COHORT_SCOPED course, a new thread is scoped to the creating
    // trainee's own cohort, not left OPEN by default — an OPEN thread
    // under a course an admin specifically chose to cohort-scope would
    // quietly defeat the whole point of that choice. A trainee with no
    // cohort assignment at all genuinely can't start a thread here —
    // there's no cohort to scope it to — and gets a clear, honest
    // message rather than a silently-open thread nobody intended.
    let cohortId: string | null = null;
    if (lesson.module.course.qaScope === "COHORT_SCOPED") {
      cohortId = await getTraineeCohortForCourse(session.userId, courseId);
      if (!cohortId) {
        return NextResponse.json(
          { error: "Q&A for this course is limited to your cohort, and you're not currently assigned to one." },
          { status: 403 }
        );
      }
    }

    const thread = await prisma.qaThread.create({
      data: {
        lessonId: params.id,
        cohortId,
        createdById: session.userId,
        title: parsed.data.title,
        posts: { create: { authorType: "TRAINEE", authorId: session.userId, content: parsed.data.content } },
      },
      include: { posts: true },
    });
    return NextResponse.json(thread, { status: 201 });
  });
}

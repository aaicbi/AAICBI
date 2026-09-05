import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { getModuleLockStatus } from "@/lib/progress";
import { hasCourseAccess } from "@/lib/courseAccess";

const BodySchema = z.object({ completed: z.boolean() });

/**
 * PUT /api/lessons/[id]/progress — a trainee marks (or unmarks) a
 * lesson complete for themselves. M12's progress unit is the Lesson,
 * not individual materials — see the schema comment on LessonProgress
 * for why. Explicit action, not inferred from "viewed the page,"
 * matching this project's preference for state that's actually
 * evidence of something (same reasoning as the NDPA consent
 * timestamp).
 *
 * Enforces the lock: a trainee can't mark progress inside a module
 * they can't access yet — this is a real enforcement point, not just
 * a UI nicety, since the button that calls this is hidden client-side
 * for a locked module but nothing stops a direct request here.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.id },
      select: { id: true, module: { select: { id: true, courseId: true, course: { select: { published: true } } } } },
    });
    // Same "don't confirm existence" reasoning as the course/module GET
    // routes: an unpublished course's lesson 404s for a trainee exactly
    // like a nonexistent one would.
    if (!lesson || !lesson.module.course.published) {
      return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    }

    // M18 — a real gap this closed: module-locking was already
    // enforced below, but nothing checked whether the trainee was
    // ever enrolled in the course at all. A never-enrolled trainee
    // could mark progress in any published course's first module,
    // since a course's first module is unlocked by default regardless
    // of enrollment.
    const enrolled = await hasCourseAccess(session.userId, lesson.module.courseId);
    if (!enrolled) {
      return NextResponse.json({ error: "You're not enrolled in this course yet." }, { status: 403 });
    }

    const lockStatus = await getModuleLockStatus(lesson.module.courseId, lesson.module.id, session.userId);
    if (!lockStatus?.unlocked) {
      return NextResponse.json(
        { error: "This module isn't unlocked yet — complete the previous module first." },
        { status: 403 }
      );
    }

    if (parsed.data.completed) {
      await prisma.lessonProgress.upsert({
        where: { lessonId_traineeId: { lessonId: params.id, traineeId: session.userId } },
        update: {},
        create: { lessonId: params.id, traineeId: session.userId },
      });
    } else {
      await prisma.lessonProgress
        .delete({ where: { lessonId_traineeId: { lessonId: params.id, traineeId: session.userId } } })
        .catch(() => {}); // already not marked complete — fine, not an error
    }

    return NextResponse.json({ ok: true, completed: parsed.data.completed });
  });
}

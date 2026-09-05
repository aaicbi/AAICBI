import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hasCourseAccess } from "@/lib/courseAccess";
import { getModuleLockStatus } from "@/lib/progress";
import { getTraineeCohortForCourse } from "@/lib/qaScope";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { qaReplyEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const ReplySchema = z.object({ content: z.string().trim().min(1) });

/**
 * POST /api/qa/threads/[id]/posts — a reply, from either a trainee or
 * staff. A real Q&A feature, not just a trainee discussion forum —
 * `QaPost.authorType` was designed for exactly this from the schema
 * up, matching the roadmap's own naming ("Q&A," not "discussion" or
 * "forum"). `requireRole()` with no arguments authenticates without
 * restricting to a specific role — the caller's actual role is read
 * from the session and branched on here, since a trainee and a staff
 * member reaching this same endpoint need genuinely different checks:
 * enrollment and module-unlock for a trainee, course ownership for
 * staff (the same discipline every other staff-facing route in this
 * project already applies).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole();

    const thread = await prisma.qaThread.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        lessonId: true,
        cohortId: true,
        createdById: true,
        lesson: {
          select: {
            module: {
              select: {
                id: true,
                courseId: true,
                course: { select: { published: true, createdById: true } },
              },
            },
          },
        },
      },
    });
    if (!thread || !thread.lesson.module.course.published) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    const courseId = thread.lesson.module.courseId;

    if (session.role === "TRAINEE") {
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
      if (!(await hasCourseAccess(session.userId, courseId))) {
        return NextResponse.json({ error: "You're not enrolled in this course yet." }, { status: 403 });
      }
      const lockStatus = await getModuleLockStatus(courseId, thread.lesson.module.id, session.userId);
      if (!lockStatus?.unlocked) {
        return NextResponse.json({ error: "This module isn't unlocked yet." }, { status: 403 });
      }
      if (thread.cohortId) {
        const traineeCohortId = await getTraineeCohortForCourse(session.userId, courseId);
        if (traineeCohortId !== thread.cohortId) {
          return NextResponse.json({ error: "Thread not found." }, { status: 404 });
        }
      }
    } else {
      // Staff — same course-ownership discipline as requireOwnedX
      // helpers elsewhere in this project, inlined here since this
      // route needs the thread already loaded regardless of caller
      // role, not a second, separate fetch just to re-check ownership.
      if (thread.lesson.module.course.createdById !== session.userId) {
        return NextResponse.json({ error: "Thread not found." }, { status: 404 });
      }
    }

    const body = await req.json();
    const parsed = ReplySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const post = await prisma.qaPost.create({
      data: {
        threadId: params.id,
        authorType: session.role === "TRAINEE" ? "TRAINEE" : "STAFF",
        authorId: session.userId,
        content: parsed.data.content,
      },
    });

    // Audit finding, closed here: a Q&A feature with no way for the
    // person who asked a question to know it's been answered doesn't
    // fulfill its own basic purpose — this was entirely missing.
    // Deliberately scoped to the thread's original creator only, and
    // only when someone ELSE replies (a trainee replying to their own
    // thread shouldn't notify themselves). Wrapped so a notification
    // failure can never block the reply that already succeeded, the
    // same discipline used throughout this project.
    if (session.userId !== thread.createdById) {
      try {
        const askerTrainee = await prisma.trainee.findUnique({ where: { id: thread.createdById } });
        if (askerTrainee && shouldNotifyTrainee(askerTrainee)) {
          const replierName =
            session.role === "TRAINEE"
              ? (await prisma.trainee.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name
              : (await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }))?.name;
          const threadPath = `/trainee/lessons/${thread.lessonId}/qa/${thread.id}`;
          const content = qaReplyEmail({
            traineeName: askerTrainee.name,
            replierName: replierName ?? "Someone",
            threadTitle: thread.title,
            threadUrl: appUrl(threadPath),
          });
          await notifyByEmail({
            recipientType: "TRAINEE",
            recipientId: askerTrainee.id,
            to: askerTrainee.email,
            type: "QA_REPLY",
            relatedId: thread.id,
            // Part 11 — make the in-app notification actionable. The
            // relative path (not the appUrl() absolute form, which is
            // for the email button) so a click in the bell lands the
            // trainee right on the thread that was replied to. The URL
            // was already being computed for the email; it just wasn't
            // reaching the in-app record.
            url: threadPath,
            subject: content.subject,
            html: content.html,
            text: content.text,
          });
        }
      } catch (e) {
        console.error(`Q&A reply notification failed for thread ${thread.id}:`, e);
      }
    }

    return NextResponse.json(post, { status: 201 });
  });
}

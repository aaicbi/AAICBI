import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hasCourseAccess } from "@/lib/courseAccess";
import { getModuleLockStatus } from "@/lib/progress";
import { getTraineeCohortForCourse } from "@/lib/qaScope";

/**
 * GET /api/qa/threads/[id] — a single thread with all its posts.
 * Deliberately re-checks cohort visibility here too, not just at the
 * list level — a trainee guessing or being sent a direct thread ID
 * from another cohort must not be able to bypass the same visibility
 * rule the list route already enforces; list-level filtering alone
 * would be a real, exploitable gap if this route trusted the ID
 * blindly. `authorType`/`authorId` has no real FK relation (see the
 * schema's own comment — a trainee or staff member can both post, and
 * a single relation can't point at either table), so author names are
 * resolved here in application code, not via a Prisma include.
 *
 * Audit finding, fixed here: this originally required exactly
 * `requireRole("TRAINEE")`, but the reply route (posts/route.ts)
 * already allowed staff to post — meaning staff could reply to a
 * thread through this app's own API while having no route that let
 * them actually read it first. Branches on the caller's real role now,
 * matching the reply route's own reasoning: course ownership for
 * staff, enrollment/module-unlock/cohort for a trainee.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole();

    const thread = await prisma.qaThread.findUnique({
      where: { id: params.id },
      include: {
        lesson: {
          select: {
            module: {
              select: { id: true, courseId: true, course: { select: { published: true, createdById: true } } },
            },
          },
        },
        posts: {
          orderBy: { createdAt: "asc" },
          include: { likes: { select: { likerType: true, likerId: true } } },
        },
      },
    });
    if (!thread || !thread.lesson.module.course.published) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }
    const courseId = thread.lesson.module.courseId;

    if (session.role === "TRAINEE") {
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
    } else if (thread.lesson.module.course.createdById !== session.userId) {
      return NextResponse.json({ error: "Thread not found." }, { status: 404 });
    }

    const traineeIds = thread.posts.filter((p: (typeof thread.posts)[number]) => p.authorType === "TRAINEE").map((p: (typeof thread.posts)[number]) => p.authorId);
    const staffIds = thread.posts.filter((p: (typeof thread.posts)[number]) => p.authorType === "STAFF").map((p: (typeof thread.posts)[number]) => p.authorId);
    const [trainees, staff] = await Promise.all([
      prisma.trainee.findMany({ where: { id: { in: traineeIds } }, select: { id: true, name: true } }),
      prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }),
    ]);
    const nameById = new Map<string, string>([
      ...trainees.map((t: { id: string; name: string }): [string, string] => [t.id, t.name]),
      ...staff.map((s: { id: string; name: string }): [string, string] => [s.id, s.name]),
    ]);

    const myLikerType = session.role === "TRAINEE" ? "TRAINEE" : "STAFF";

    return NextResponse.json({
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt,
      isStaffViewer: session.role !== "TRAINEE",
      posts: thread.posts.map((p: (typeof thread.posts)[number]) => ({
        id: p.id,
        authorType: p.authorType,
        authorId: p.authorId,
        authorName: nameById.get(p.authorId) ?? "Unknown",
        content: p.content,
        createdAt: p.createdAt,
        likeCount: p.likes.length,
        likedByMe: p.likes.some(
          (l: { likerType: string; likerId: string }) => l.likerType === myLikerType && l.likerId === session.userId
        ),
      })),
    });
  });
}

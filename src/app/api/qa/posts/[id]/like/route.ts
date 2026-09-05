import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hasCourseAccess } from "@/lib/courseAccess";
import { getModuleLockStatus } from "@/lib/progress";
import { getTraineeCohortForCourse } from "@/lib/qaScope";

/**
 * POST /api/qa/posts/[id]/like — a toggle, not a separate like/unlike
 * pair of routes: calling this again on an already-liked post removes
 * the like, matching how every real "like" button anyone has ever
 * used actually behaves. Same discriminator pattern as QaPost's own
 * authorType/authorId — a trainee or staff member can both like a
 * post, mirroring who can both post one.
 *
 * Same access discipline as the reply route this mirrors: enrollment,
 * module-unlock, and cohort-visibility for a trainee; course
 * ownership for staff. A suspended trainee can't like a post either,
 * not just post one — a like is still an active endorsement, not
 * passive reading, the same "posting privileges suspended, reading
 * stays available" line M41 already draws, just applied to a lighter-
 * weight form of contribution.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole();

    const post = await prisma.qaPost.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        threadId: true,
        thread: {
          select: {
            cohortId: true,
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
        },
      },
    });
    if (!post || !post.thread.lesson.module.course.published) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }
    const courseId = post.thread.lesson.module.courseId;

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
      const lockStatus = await getModuleLockStatus(courseId, post.thread.lesson.module.id, session.userId);
      if (!lockStatus?.unlocked) {
        return NextResponse.json({ error: "This module isn't unlocked yet." }, { status: 403 });
      }
      if (post.thread.cohortId) {
        const traineeCohortId = await getTraineeCohortForCourse(session.userId, courseId);
        if (traineeCohortId !== post.thread.cohortId) {
          return NextResponse.json({ error: "Post not found." }, { status: 404 });
        }
      }
    } else if (post.thread.lesson.module.course.createdById !== session.userId) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    const likerType = session.role === "TRAINEE" ? "TRAINEE" : "STAFF";
    const existing = await prisma.qaPostLike.findUnique({
      where: { postId_likerType_likerId: { postId: params.id, likerType, likerId: session.userId } },
    });

    if (existing) {
      await prisma.qaPostLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }
    await prisma.qaPostLike.create({ data: { postId: params.id, likerType, likerId: session.userId } });
    return NextResponse.json({ liked: true });
  });
}

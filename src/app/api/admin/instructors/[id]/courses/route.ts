import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { courseInstructorAssignedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

const AssignCourseSchema = z.object({ courseId: z.string().min(1) });

/**
 * POST /api/admin/instructors/[id]/courses — assigns an existing
 * course to this instructor by setting Course.createdById, the same
 * real ownership link every other instructor-scoped view already
 * reads (GET /api/courses, the Performance Dashboard, payout
 * configuration, the Instructor Portal's "My Courses"/"Teaching
 * Materials"/"My Payments"). Reassigning it here is what makes those
 * pages start showing this course for this instructor — there's no
 * separate "assignment" table to keep in sync.
 *
 * Same ownership boundary as PUT /api/admin/courses/[id]/payout:
 * SUPER_ADMIN can reassign any course; ADMIN only a course they
 * currently own (handing off their own course to an instructor they
 * manage is fine; reassigning someone else's course is a Super Admin
 * decision, same reasoning as payout configuration).
 *
 * Security audit finding — the COURSE side was already correctly
 * scoped (line below), but the INSTRUCTOR side had no check at all: a
 * training-org session could reassign its own course to an arbitrary
 * real instructor id. Blocked the same way as every other
 * /api/admin/instructors/** route — a training-org session has no
 * legitimate instructor to assign to in the first place.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const instructor = await prisma.user.findUnique({ where: { id: params.id, role: "INSTRUCTOR" }, select: { id: true, name: true, email: true } });
    if (!instructor) {
      return NextResponse.json({ error: "Instructor not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = AssignCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true, title: true, createdById: true } });
    if (!course || (session.role !== "SUPER_ADMIN" && course.createdById !== session.userId)) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }
    if (course.createdById === instructor.id) {
      return NextResponse.json({ error: "This instructor is already assigned to that course." }, { status: 409 });
    }

    const updated = await prisma.course.update({
      where: { id: course.id },
      data: { createdById: instructor.id },
      select: { id: true, title: true },
    });

    try {
      const emailContent = courseInstructorAssignedEmail(instructor.name, course.title, appUrl("/instructor/courses"));
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: instructor.id,
        to: instructor.email,
        type: "COURSE_INSTRUCTOR_ASSIGNED",
        relatedId: course.id,
        url: "/instructor/courses",
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
    } catch (e) {
      console.error(`Course-instructor assignment notification failed for course ${course.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}

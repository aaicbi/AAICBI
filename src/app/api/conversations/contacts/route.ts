import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveActor, isBlocked } from "@/lib/messaging";

/**
 * GET /api/conversations/contacts — the "new conversation" picker.
 * Trainee: cohort-mates + staff who own a course they're cohort-
 * enrolled in + every SUPER_ADMIN. ADMIN/INSTRUCTOR: trainees reachable
 * via a course they own. SUPER_ADMIN: everyone (unscoped, matching
 * their full-oversight access elsewhere in this feature).
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "EMPLOYER", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const me = await resolveActor(session);

    let contacts: { type: "TRAINEE" | "STAFF" | "EMPLOYER"; id: string; name: string }[] = [];

    if (session.role === "SUPER_ADMIN") {
      const [trainees, staff, employers] = await Promise.all([
        prisma.trainee.findMany({ select: { id: true, name: true } }),
        prisma.user.findMany({ where: { id: { not: session.userId } }, select: { id: true, name: true } }),
        prisma.employer.findMany({ where: { approvalState: "APPROVED" }, select: { id: true, companyName: true } }),
      ]);
      contacts = [
        ...trainees.map((t) => ({ type: "TRAINEE" as const, id: t.id, name: t.name })),
        ...staff.map((u) => ({ type: "STAFF" as const, id: u.id, name: u.name })),
        ...employers.map((e) => ({ type: "EMPLOYER" as const, id: e.id, name: e.companyName })),
      ];
    } else if (session.role === "EMPLOYER") {
      // Trainees who engaged with this employer, and every Super Admin for support.
      const [intros, applications, superAdmins] = await Promise.all([
        prisma.introductionRequest.findMany({ where: { employerId: session.userId, status: "ACCEPTED" }, select: { trainee: { select: { id: true, name: true } } } }),
        prisma.jobApplication.findMany({ where: { jobPosting: { employerId: session.userId } }, select: { trainee: { select: { id: true, name: true } } } }),
        prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true, name: true } }),
      ]);
      const traineeMap = new Map<string, string>();
      for (const r of [...intros, ...applications]) traineeMap.set(r.trainee.id, r.trainee.name);
      contacts = [
        ...Array.from(traineeMap, ([id, name]) => ({ type: "TRAINEE" as const, id, name })),
        ...superAdmins.map((a) => ({ type: "STAFF" as const, id: a.id, name: a.name })),
      ];
    } else if (session.role === "ADMIN" || session.role === "INSTRUCTOR") {
      const enrollments = await prisma.enrollmentRecord.findMany({
        where: { cohort: { course: { createdById: session.userId } } },
        select: { trainee: { select: { id: true, name: true } } },
      });
      const seen = new Map<string, string>();
      for (const e of enrollments) seen.set(e.trainee.id, e.trainee.name);
      contacts = Array.from(seen, ([id, name]) => ({ type: "TRAINEE" as const, id, name }));
    } else {
      const [cohortMateRecords, ownedCourseStaff, superAdmins] = await Promise.all([
        prisma.enrollmentRecord.findMany({ where: { traineeId: session.userId }, select: { cohortId: true } }),
        prisma.course.findMany({
          where: { cohorts: { some: { enrollments: { some: { traineeId: session.userId } } } } },
          select: { createdBy: { select: { id: true, name: true } } },
        }),
        prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true, name: true } }),
      ]);
      const myCohortIds = cohortMateRecords.map((c) => c.cohortId);
      const mates = await prisma.enrollmentRecord.findMany({
        where: { cohortId: { in: myCohortIds }, traineeId: { not: session.userId } },
        select: { trainee: { select: { id: true, name: true } } },
      });
      const traineeMap = new Map<string, string>();
      for (const m of mates) traineeMap.set(m.trainee.id, m.trainee.name);
      const staffMap = new Map<string, string>();
      for (const c of ownedCourseStaff) staffMap.set(c.createdBy.id, c.createdBy.name);
      for (const a of superAdmins) staffMap.set(a.id, a.name);
      // Employers this trainee has engaged with (accepted their introduction or applied to their job).
      const [acceptedIntros, myApplications] = await Promise.all([
        prisma.introductionRequest.findMany({ where: { traineeId: session.userId, status: "ACCEPTED" }, select: { employer: { select: { id: true, companyName: true } } } }),
        prisma.jobApplication.findMany({ where: { traineeId: session.userId }, select: { jobPosting: { select: { employer: { select: { id: true, companyName: true } } } } } }),
      ]);
      const employerMap = new Map<string, string>();
      for (const i of acceptedIntros) employerMap.set(i.employer.id, i.employer.companyName);
      for (const a of myApplications) employerMap.set(a.jobPosting.employer.id, a.jobPosting.employer.companyName);
      contacts = [
        ...Array.from(traineeMap, ([id, name]) => ({ type: "TRAINEE" as const, id, name })),
        ...Array.from(staffMap, ([id, name]) => ({ type: "STAFF" as const, id, name })),
        ...Array.from(employerMap, ([id, name]) => ({ type: "EMPLOYER" as const, id, name })),
      ];
    }

    const withBlockStatus = await Promise.all(
      contacts.map(async (c) => ({ ...c, alreadyBlocked: await isBlocked({ type: me.actorType, id: me.actorId }, { type: c.type, id: c.id }) }))
    );

    return NextResponse.json(withBlockStatus);
  });
}

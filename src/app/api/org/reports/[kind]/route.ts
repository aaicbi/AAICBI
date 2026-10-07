import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { toCsv } from "@/lib/csv";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";

type Kind = "enrollments" | "courses" | "cohorts";
const KINDS: Kind[] = ["enrollments", "courses", "cohorts"];

function slug(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "organization";
}

/**
 * GET /api/org/reports/[kind] — CSV downloads for a training
 * organization: enrolments, course completion, and cohort rosters.
 * Every query is scoped to courses created by the signed-in
 * organization's own account; the organization comes from the session on
 * the server, never from the request.
 */
export async function GET(_req: Request, { params }: { params: { kind: string } }) {
  return withApiErrors(async () => {
    const { session, org } = await requireTrainingOrgSession();
    if (!KINDS.includes(params.kind as Kind)) {
      return NextResponse.json({ error: "Unknown report." }, { status: 404 });
    }
    const kind = params.kind as Kind;
    const createdById = session.userId;
    let csv: string;

    if (kind === "enrollments") {
      const [enrollments, certificates] = await Promise.all([
        prisma.courseEnrollment.findMany({
          where: { course: { createdById }, unlockedAt: { not: null } },
          orderBy: [{ enrolledAt: "desc" }],
          select: {
            traineeId: true,
            courseId: true,
            enrolledAt: true,
            completedAt: true,
            accessRevokedAt: true,
            trainee: { select: { name: true, email: true } },
            course: { select: { title: true } },
          },
        }),
        prisma.certificate.findMany({
          where: { course: { createdById }, revokedAt: null },
          select: { traineeId: true, courseId: true, code: true },
        }),
      ]);
      const codes = new Map(certificates.map((c) => [`${c.traineeId}:${c.courseId}`, c.code]));
      csv = toCsv(
        ["Trainee", "Email", "Course", "Enrolled on", "Status", "Completed on", "Certificate code"],
        enrollments.map((e) => [
          e.trainee.name,
          e.trainee.email,
          e.course.title,
          e.enrolledAt,
          e.completedAt ? "Completed" : e.accessRevokedAt ? "Access ended" : "In progress",
          e.completedAt,
          codes.get(`${e.traineeId}:${e.courseId}`) ?? "",
        ])
      );
    } else if (kind === "courses") {
      const [courses, enrolled, completed, certs] = await Promise.all([
        prisma.course.findMany({ where: { createdById }, orderBy: { title: "asc" }, select: { id: true, title: true, published: true } }),
        prisma.courseEnrollment.groupBy({ by: ["courseId"], where: { course: { createdById }, unlockedAt: { not: null } }, _count: { _all: true } }),
        prisma.courseEnrollment.groupBy({ by: ["courseId"], where: { course: { createdById }, unlockedAt: { not: null }, completedAt: { not: null } }, _count: { _all: true } }),
        prisma.certificate.groupBy({ by: ["courseId"], where: { course: { createdById }, revokedAt: null }, _count: { _all: true } }),
      ]);
      const n = (rows: { courseId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.courseId, r._count._all]));
      const e = n(enrolled), d = n(completed), c = n(certs);
      csv = toCsv(
        ["Course", "Published", "Enrolled", "Completed", "Completion rate (%)", "Certificates issued"],
        courses.map((x) => {
          const en = e.get(x.id) ?? 0;
          const co = d.get(x.id) ?? 0;
          return [x.title, x.published ? "Yes" : "No", en, co, en ? Math.round((co / en) * 100) : "", c.get(x.id) ?? 0];
        })
      );
    } else {
      const cohorts = await prisma.cohort.findMany({
        where: { course: { createdById } },
        orderBy: [{ startDate: "desc" }, { name: "asc" }],
        select: {
          name: true,
          startDate: true,
          endDate: true,
          course: { select: { title: true } },
          enrollments: { select: { trainee: { select: { name: true, email: true } } } },
        },
      });
      csv = toCsv(
        ["Cohort", "Course", "Starts", "Ends", "Trainee", "Email"],
        cohorts.flatMap((c) =>
          c.enrollments.length
            ? c.enrollments.map((m) => [c.name, c.course.title, c.startDate, c.endDate, m.trainee.name, m.trainee.email])
            : [[c.name, c.course.title, c.startDate, c.endDate, "", ""]]
        )
      );
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug(org.name)}-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}

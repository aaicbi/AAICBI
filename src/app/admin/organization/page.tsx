import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { countActiveTrainingOrgTrainees } from "@/lib/trainingOrgSeatCap";
import { shouldShowCertWatermark } from "@/lib/trainingOrgBilling";
import Card from "@/components/ui/Card";
import { CourseProgressTable, RecentTraineesTable, CohortsTable } from "@/components/org/OrgOverviewTables";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

export const metadata = { title: "Organization overview" };

/**
 * A training organization's home: who is learning, how far they have
 * got, and what the organization's plan allows. Until now an
 * organization landed on the generic admin dashboard and had no single
 * place to answer "how is my cohort doing".
 *
 * Every query is scoped to courses created by this organization's own
 * shadow staff account (Course.createdById), the same ownership key
 * the rest of the org experience uses. Trainees appear by name only.
 * A session that is not an organization's ADMIN is sent to the normal
 * dashboard; the server-side scope here, not the sidebar link, is what
 * keeps another organization's data out.
 */
export default async function OrganizationOverviewPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");

  const createdById = session.userId;
  const owned = { course: { createdById }, unlockedAt: { not: null } } as const;

  const [courses, enrolledByCourse, completedByCourse, recent, certificatesIssued, activeTrainees, cohorts, memberCount] = await Promise.all([
    prisma.course.findMany({
      where: { createdById },
      select: { id: true, title: true, published: true },
      orderBy: { title: "asc" },
    }),
    prisma.courseEnrollment.groupBy({ by: ["courseId"], where: owned, _count: { _all: true } }),
    prisma.courseEnrollment.groupBy({
      by: ["courseId"],
      where: { ...owned, completedAt: { not: null } },
      _count: { _all: true },
    }),
    prisma.courseEnrollment.findMany({
      where: owned,
      orderBy: { enrolledAt: "desc" },
      take: 25,
      select: {
        id: true,
        enrolledAt: true,
        completedAt: true,
        accessRevokedAt: true,
        trainee: { select: { name: true } },
        course: { select: { title: true } },
      },
    }),
    prisma.certificate.count({ where: { course: { createdById }, revokedAt: null } }),
    countActiveTrainingOrgTrainees(createdById),
    prisma.cohort.findMany({
      where: { course: { createdById } },
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        course: { select: { title: true } },
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.trainingOrganizationMember.count({ where: { trainingOrganizationId: org.id, disabledAt: null } }),
  ]);

  const enrolled = new Map(enrolledByCourse.map((r) => [r.courseId, r._count._all]));
  const completed = new Map(completedByCourse.map((r) => [r.courseId, r._count._all]));
  const seatCap = org.billingModel === "DIRECT_PAYMENT" && org.trainingSeatCap ? org.trainingSeatCap : null;
  const seatPercent = seatCap ? Math.min(100, Math.round((activeTrainees / seatCap) * 100)) : 0;
  const watermarkOn = shouldShowCertWatermark(org);
  const publishedCount = courses.filter((c) => c.published).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">{org.name}</h1>
      <p className="mt-1 text-sm text-gray-600">Your trainees, their progress and your plan at a glance.</p>

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active trainees" value={activeTrainees} note={seatCap ? `of ${seatCap} seats` : "No seat limit"} />
        <Stat label="Courses" value={courses.length} note={`${publishedCount} published`} />
        <Stat label="Certificates issued" value={certificatesIssued} note="Not revoked" />
        <Stat
          label="Completion"
          value={`${percent(sum(completed), sum(enrolled))}%`}
          note={`${sum(completed)} of ${sum(enrolled)} enrolments`}
        />
      </section>

      {seatCap && (
        <Card className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-brand-ink">Seat usage</h2>
            <p className="text-sm tabular-nums text-gray-600">
              {activeTrainees} of {seatCap} used
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-brand-gray/60"
            role="progressbar"
            aria-label="Seats used"
            aria-valuemin={0}
            aria-valuemax={seatCap}
            aria-valuenow={Math.min(activeTrainees, seatCap)}
          >
            <div
              className={`h-full rounded-full ${seatPercent >= 90 ? "bg-brand-rose" : "bg-brand-teal"}`}
              style={{ width: `${seatPercent}%` }}
            />
          </div>
          {seatPercent >= 90 && (
            <p className="mt-2 text-sm text-brand-rose">
              You are close to your seat limit. New trainees cannot be enrolled once it is reached. Contact AAICBI to
              raise it.
            </p>
          )}
        </Card>
      )}

      <section className="mt-8" aria-labelledby="by-course">
        <h2 id="by-course" className="font-display text-lg font-semibold text-brand-ink">
          Progress by course
        </h2>
        {courses.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No courses yet"
              description="Create your first course and your trainees' progress will show up here."
              action={
                <Link href="/admin/courses/new" className="text-sm font-semibold text-brand-teal hover:underline">
                  Create a course
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-brand-gray bg-brand-surface p-4">
            <CourseProgressTable
              rows={courses.map((c) => ({ id: c.id, title: c.title, published: c.published, enrolled: enrolled.get(c.id) ?? 0, completed: completed.get(c.id) ?? 0 }))}
            />
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="recent">
        <h2 id="recent" className="font-display text-lg font-semibold text-brand-ink">
          Recent trainees
        </h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">No one has enrolled in your courses yet.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-brand-gray bg-brand-surface p-4">
            <RecentTraineesTable
              rows={recent.map((r) => ({
                id: r.id,
                name: r.trainee.name,
                course: r.course.title,
                status: r.completedAt ? "completed" : r.accessRevokedAt ? "ended" : "progress",
                enrolledAt: r.enrolledAt.toISOString(),
              }))}
            />
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="cohorts">
        <h2 id="cohorts" className="font-display text-lg font-semibold text-brand-ink">
          Cohorts
        </h2>
        {cohorts.length === 0 ? (
          <p className="mt-3 text-sm text-gray-600">
            You have no cohorts yet. Open a course and choose Cohorts to group trainees who start together.
          </p>
        ) : (
          <div className="mt-3 rounded-xl border border-brand-gray bg-brand-surface p-4">
            <CohortsTable
              rows={cohorts.map((c) => ({
                id: c.id,
                name: c.name,
                course: c.course.title,
                startDate: c.startDate ? c.startDate.toISOString() : null,
                endDate: c.endDate ? c.endDate.toISOString() : null,
                members: c._count.enrollments,
              }))}
            />
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="font-display text-base font-semibold text-brand-ink">Reports</h2>
          <p className="mt-1 text-sm text-gray-600">Download your data as spreadsheets (CSV).</p>
          <ul className="mt-3 space-y-1.5 text-sm font-semibold">
            <li>
              <a href="/api/org/reports/enrollments" className="text-brand-teal hover:underline">
                Trainees and their progress
              </a>
            </li>
            <li>
              <a href="/api/org/reports/courses" className="text-brand-teal hover:underline">
                Completion by course
              </a>
            </li>
            <li>
              <a href="/api/org/reports/cohorts" className="text-brand-teal hover:underline">
                Cohort rosters
              </a>
            </li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-display text-base font-semibold text-brand-ink">Team</h2>
          <p className="mt-1 text-sm text-gray-600">
            {memberCount === 0 ? "Only you can sign in to this account." : `${memberCount} teammate${memberCount === 1 ? "" : "s"} can sign in alongside you.`}
          </p>
          <Link href="/admin/organization/team" className="mt-3 inline-block text-sm font-semibold text-brand-teal hover:underline">
            Manage your team
          </Link>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="font-display text-base font-semibold text-brand-ink">Certificates and plan</h2>
        <p className="mt-1 text-sm text-gray-600">
          {watermarkOn
            ? 'Your certificates carry a "Powered by aaicbi.org" line.'
            : "Your certificates are shown without the AAICBI line."}
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
          <Link href="/admin/certificate-templates" className="text-brand-teal hover:underline">
            {watermarkOn ? "Design certificates or remove the line" : "Design certificates"}
          </Link>
          <Link href="/org/billing" className="text-brand-teal hover:underline">
            Billing and plan
          </Link>
        </div>
      </Card>
    </main>
  );
}

function sum(m: Map<string, number>) {
  let t = 0;
  m.forEach((v) => (t += v));
  return t;
}

function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function Stat({ label, value, note }: { label: string; value: number | string; note: string }) {
  return (
    <div className="rounded-xl border border-brand-gray bg-brand-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-brand-ink">{value}</p>
      <p className="mt-0.5 text-xs text-gray-600">{note}</p>
    </div>
  );
}

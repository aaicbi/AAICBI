import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { countActiveTrainingOrgTrainees } from "@/lib/trainingOrgSeatCap";
import { shouldShowCertWatermark } from "@/lib/trainingOrgBilling";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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

  const [courses, enrolledByCourse, completedByCourse, recent, certificatesIssued, activeTrainees] = await Promise.all([
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
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-gray bg-brand-surface">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-gray text-xs uppercase tracking-wide text-gray-600">
                  <th scope="col" className="px-4 py-3 font-semibold">Course</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Enrolled</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Completed</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Rate</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => {
                  const e = enrolled.get(c.id) ?? 0;
                  const d = completed.get(c.id) ?? 0;
                  return (
                    <tr key={c.id} className="border-b border-brand-gray last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/courses/${c.id}`} className="font-semibold text-brand-ink hover:text-brand-teal">
                          {c.title}
                        </Link>
                        {!c.published && (
                          <span className="ml-2">
                            <Badge variant="neutral">Draft</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{e}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{d}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{e ? `${percent(d, e)}%` : "None yet"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
          <div className="mt-3 overflow-x-auto rounded-xl border border-brand-gray bg-brand-surface">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-brand-gray text-xs uppercase tracking-wide text-gray-600">
                  <th scope="col" className="px-4 py-3 font-semibold">Trainee</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Course</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-brand-gray last:border-0">
                    <td className="px-4 py-3 font-semibold text-brand-ink">{r.trainee.name}</td>
                    <td className="px-4 py-3">{r.course.title}</td>
                    <td className="px-4 py-3">
                      {r.completedAt ? (
                        <Badge variant="success">Completed</Badge>
                      ) : r.accessRevokedAt ? (
                        <Badge variant="neutral">Access ended</Badge>
                      ) : (
                        <Badge variant="warning">In progress</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.enrolledAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Card className="mt-8">
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

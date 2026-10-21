import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import ReportActions from "@/components/reports/ReportActions";

export const metadata = { title: "Trainees" };

/**
 * An organization's own trainees: everyone enrolled in one of its courses, found by name or email.
 * The platform-wide trainee console at /admin/trainees is for the AAICBI team; this page only ever
 * reads enrollments in courses created by this organization's own account, so another organization's
 * trainees can never appear here.
 */
export default async function OrganizationTraineesPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") redirect("/admin/dashboard");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) redirect("/admin/dashboard");

  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const enrollments = await prisma.courseEnrollment.findMany({
    where: {
      course: { createdById: session.userId },
      ...(q ? { trainee: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } : {}),
    },
    orderBy: { enrolledAt: "desc" },
    take: 2000,
    select: { enrolledAt: true, completedAt: true, accessRevokedAt: true, course: { select: { id: true, title: true } }, trainee: { select: { id: true, name: true, email: true } } },
  });

  const people = new Map<string, { id: string; name: string; email: string; latest: Date; courses: { id: string; title: string; label: string; variant: "success" | "warning" | "danger" | "gold" }[] }>();
  for (const e of enrollments) {
    const label = e.completedAt ? "Completed" : e.accessRevokedAt ? "Access ended" : "In progress";
    const variant = e.completedAt ? "gold" : e.accessRevokedAt ? "danger" : "success";
    const p = people.get(e.trainee.id) ?? { ...e.trainee, latest: e.enrolledAt, courses: [] };
    p.courses.push({ id: e.course.id, title: e.course.title, label, variant });
    if (e.enrolledAt > p.latest) p.latest = e.enrolledAt;
    people.set(e.trainee.id, p);
  }
  const rows = [...people.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Trainees" }]} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">Trainees</h1>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Everyone enrolled in your courses. Open a course and choose Enrollments to give someone access, extend it or end it.</p>
      <div className="mt-4"><ReportActions q={q} /></div>
      <form method="get" className="mt-5 flex gap-2" role="search">
        <Input name="q" defaultValue={q} placeholder="Search by name or email" label="Search trainees" hideLabel wrapperClassName="w-full max-w-sm" />
        <button type="submit" className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent">Search</button>
      </form>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <EmptyState title={q ? "No trainees match that search" : "No trainees yet"} description={q ? "Try a different name or email." : "Trainees appear here once they are enrolled in one of your courses."} />
        ) : (
          rows.map((p) => (
            <Card key={p.id}>
              <div data-testid="org-trainee-row" className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/admin/organization/trainees/${p.id}`} className="font-display font-semibold text-brand-ink underline-offset-2 hover:underline">{p.name}</Link>
                  <p className="text-xs text-gray-600 [overflow-wrap:anywhere]">{p.email}</p>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {p.courses.map((c) => (
                    <li key={c.id}>
                      <Link href={`/admin/courses/${c.id}/enrollments`} className="inline-flex items-center gap-2 text-xs text-brand-ink hover:underline">
                        {c.title} <Badge variant={c.variant}>{c.label}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))
        )}
      </div>
    </main>
  );
}

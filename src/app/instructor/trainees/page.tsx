import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { rosterCourseIds } from "@/lib/reports/access";
import { getRoster } from "@/lib/reports/performance";
import { fmtDate } from "@/lib/reports/performanceCore";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/instructor/LogoutButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import ReportActions from "@/components/reports/ReportActions";

export const metadata = { title: "Trainee reports" };
export const dynamic = "force-dynamic";

const INSTRUCTOR_NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Trainee Reports", href: "/instructor/trainees" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

/** Every trainee in the instructor's courses, with a performance line each; open one for the full report, export all, or email it. */
export default async function InstructorTraineesPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getSession();
  if (!session || session.role !== "INSTRUCTOR") redirect("/admin/login");
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const ids = (await rosterCourseIds(session)) ?? [];
  const { rows } = await getRoster(ids, q);
  return (
    <>
      <SiteHeader nav={INSTRUCTOR_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Trainee reports</h1>
        <p className="mt-1 text-sm text-gray-600">Select a trainee for their full report, or export and email the whole list.</p>
        <div className="mt-4"><ReportActions q={q} /></div>
        <form method="get" className="mt-4 flex gap-2" role="search">
          <Input name="q" defaultValue={q} placeholder="Search by name or email" label="Search trainees" hideLabel wrapperClassName="w-full max-w-sm" />
          <button type="submit" className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-semibold text-brand-onAccent">Search</button>
        </form>
        <div className="mt-4 space-y-3">
          {rows.length === 0 ? <EmptyState title="No trainees yet" description="Trainees appear once they are enrolled in one of your courses." /> : rows.map((r) => (
            <Card key={r.traineeId}>
              <div className="flex flex-wrap items-center justify-between gap-3" data-testid="report-row">
                <div className="min-w-0"><Link href={`/instructor/trainees/${r.traineeId}`} className="font-display font-semibold text-brand-ink hover:underline">{r.name}</Link><p className="text-xs text-gray-600 [overflow-wrap:anywhere]">{r.email}</p></div>
                <p className="text-xs text-gray-700">Progress {r.percent}% · {r.attempts} attempt{r.attempts === 1 ? "" : "s"}, {r.passed} passed · avg {r.average ?? "—"}% · {r.level} · last active {fmtDate(r.lastActive)}</p>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}

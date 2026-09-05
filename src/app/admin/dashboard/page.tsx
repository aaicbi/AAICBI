import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { createdByFilter } from "@/lib/courseOwnership";
import LogoutButton from "@/components/admin/LogoutButton";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

export default async function AdminDashboardPage() {
  const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR"); // middleware already redirects, this is belt-and-braces
  // Audit finding, closed here: this was a bare `{ createdById:
  // session.userId }`, meaning even a SUPER_ADMIN only ever saw their
  // own exams here — the one genuine inconsistency with the
  // established, deliberate pattern this project already uses
  // everywhere else a staff list route needs this exact distinction
  // (see /api/courses's own use of the same helper, and
  // createdByFilter's own comment for the full reasoning: SUPER_ADMIN
  // sees everything on a list/GET route, narrowly scoped to visibility
  // only, never a bypass on anything that modifies data).
  const exams = await prisma.exam.findMany({
    where: createdByFilter(session),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Examinations</h1>
            <p className="text-sm text-gray-600">Signed in as {session.email}</p>
          </div>
          <Button href="/admin/exams/new">+ Create Examination</Button>
        </div>

        <div className="mt-8 space-y-3">
          {exams.length === 0 && (
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No examinations yet"
              description="Create one and upload a Word document to get started."
            />
          )}
          {exams.map((exam) => (
            <Card key={exam.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-display font-semibold text-brand-ink">{exam.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="font-mono">{exam.code}</span>
                  <span>{exam._count.questions} questions</span>
                  <span>{exam._count.attempts} attempts</span>
                  <Badge variant={exam.published ? "success" : "neutral"}>
                    {exam.published ? "Published" : "Draft"}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/exams/${exam.id}/import`}
                  className="rounded-lg border border-brand-gray px-3 py-2 text-sm font-semibold hover:border-brand-teal"
                >
                  Questions
                </Link>
                <Link
                  href={`/admin/exams/${exam.id}/results`}
                  className="rounded-lg border border-brand-gray px-3 py-2 text-sm font-semibold hover:border-brand-teal"
                >
                  Results
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}

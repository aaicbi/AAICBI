import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { createdByFilter } from "@/lib/courseOwnership";
import { ADMIN_NAV } from "@/lib/admin/nav";
import LogoutButton from "@/components/admin/LogoutButton";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Icon from "@/components/ui/Icon";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { ClipboardCheck } from "lucide-react";

const ALLOWED_ROLES = ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"];

/**
 * Admin Dashboard & Examinations redesign (Phase 2) — the real
 * "Examinations" index the admin nav's own link had always promised but
 * never actually pointed at (it went to /admin/dashboard instead).
 * Relocates, does not reinvent: the exact same `prisma.exam.findMany`
 * query (same `createdByFilter` role-scoping — SUPER_ADMIN sees every
 * exam, ADMIN/INSTRUCTOR only their own), the same Questions/Results
 * links, the same Published/Draft badge, the same "Create Examination"
 * button and empty state, all previously embedded directly inside
 * dashboard/page.tsx. The dashboard now keeps only a compact summary
 * pointing here — see that file's own comment.
 */
export default async function AdminExamsPage() {
  const session = await getSession();
  if (!session || !ALLOWED_ROLES.includes(session.role)) {
    redirect("/admin/login");
  }

  const exams = await prisma.exam.findMany({
    where: createdByFilter(session),
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });

  return (
    <>
      <SiteHeader nav={ADMIN_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
              <Icon icon={ClipboardCheck} size="lg" /> Examinations
            </h1>
            <p className="text-sm text-gray-600">Signed in as {session.email}</p>
          </div>
          <Button href="/admin/exams/new">+ Create Examination</Button>
        </div>

        {exams.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="No examinations yet"
              description="Create one and upload a Word document to get started."
            />
          </div>
        ) : (
          <Card className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-gray text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4">Examination</th>
                    <th className="pb-2 pr-4">Code</th>
                    <th className="pb-2 pr-4 text-right">Questions</th>
                    <th className="pb-2 pr-4 text-right">Attempts</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {exams.map((exam) => (
                    <tr key={exam.id} className="border-b border-gray-100 align-top">
                      <td className="py-2.5 pr-4 font-medium text-brand-ink">{exam.title}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">{exam.code}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-600">{exam._count.questions}</td>
                      <td className="py-2.5 pr-4 text-right text-gray-600">{exam._count.attempts}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant={exam.published ? "success" : "neutral"}>
                          {exam.published ? "Published" : "Draft"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/exams/${exam.id}/import`}
                            className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold hover:border-brand-teal"
                          >
                            Questions
                          </Link>
                          <Link
                            href={`/admin/exams/${exam.id}/results`}
                            className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold hover:border-brand-teal"
                          >
                            Results
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}

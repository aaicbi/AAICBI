import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { createdByFilter } from "@/lib/courseOwnership";
import { ADMIN_NAV } from "@/lib/admin/nav";
import ExamsTable from "@/components/admin/ExamsTable";
import LogoutButton from "@/components/admin/LogoutButton";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
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
            <ExamsTable
              exams={exams.map((e) => ({
                id: e.id,
                title: e.title,
                code: e.code,
                questions: e._count.questions,
                attempts: e._count.attempts,
                published: e.published,
              }))}
            />
          </Card>
        )}
      </main>
    </>
  );
}

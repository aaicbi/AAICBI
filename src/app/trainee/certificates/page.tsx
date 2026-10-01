import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { AchievementIcon } from "@/components/icons/brand";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";

/**
 * Dashboard/Examination redesign — no dedicated certificate list page
 * existed before this; only the dashboard's own trophy-case snippet.
 * Same query (non-revoked, ordered by issuedAt desc) the dashboard
 * already runs, no new business logic — every card links to the
 * existing, unmodified public verification page.
 */
export default async function TraineeCertificatesPage() {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") redirect("/trainee/login");

  const certificates = await prisma.certificate.findMany({
    where: { traineeId: session.userId, revokedAt: null },
    select: { code: true, issuedAt: true, course: { select: { title: true } } },
    orderBy: { issuedAt: "desc" },
  });

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand-ink">
          <Icon icon={AchievementIcon} size="lg" /> Certificates
        </h1>
        <p className="mt-1 text-sm text-gray-500">Credentials you've earned by passing a course examination.</p>

        {certificates.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              illustration={<AchievementDoodle className="h-full w-full" />}
              title="No certificates yet"
              description="Pass a course's final examination to earn your first certificate — it will show up here automatically."
              action={
                <Button href="/trainee/courses" size="md">
                  Browse Courses
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <Link key={cert.code} href={`/certificate/${cert.code}`} target="_blank" rel="noopener noreferrer">
                <Card variant="celebratory" interactive className="h-full">
                  <div className="flex items-start gap-3">
                    <Icon icon={AchievementIcon} size="lg" />
                    <div>
                      <p className="font-display text-sm font-semibold text-brand-ink">{cert.course.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Issued {cert.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-brand-teal">View &amp; verify →</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

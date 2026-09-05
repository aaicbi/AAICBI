import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getModuleLockMap, getResumeTarget } from "@/lib/progress";
import { expireStaleAttemptsForTrainee } from "@/lib/examEngine";
import LogoutButton from "@/components/trainee/LogoutButton";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import TraineeOnboarding from "@/components/trainee/TraineeOnboarding";

/**
 * M12 — replaces the M10-era empty shell (browsing-only, no progress)
 * with a real "Continue Learning" list, per the roadmap's own
 * extension-points note ("progress tracking... are M12 work, once
 * M11's assessments exist to measure progress against").
 *
 * Kept as a server component, same as the page it replaces — the
 * progress computation is a direct reuse of getModuleLockMap
 * (src/lib/progress.ts), not a second HTTP round-trip through
 * /api/trainee/progress, which exists for API consumers that don't
 * have server-side DB access, not for this page.
 *
 * Design-pass update: added a certificates "trophy case" — the
 * dashboard is where a trainee lands most often, and it previously
 * gave zero visibility to earned certificates even though those are
 * this platform's flagship achievement. Also fixed a real, active bug
 * found while doing this: the email-unverified notice still said
 * verification "isn't wired up yet... documented M14 task," which
 * became false the moment M14 shipped a real verification email —
 * same fix applied to the post-registration screen (register/page.tsx).
 *
 * Design-pass update, dark-mode audit follow-through: the
 * most-recently-active course was previously just the first item in a
 * flat "Continue Learning" list, no different in visual weight from
 * any other course a trainee had ever touched. Pulled into its own
 * prominent hero card at the top of the page, linking directly to the
 * exact next lesson or assessment (see getResumeTarget in
 * progress.ts) rather than back to the course overview — the actual
 * "continue where you left off" pattern this redesign was built
 * around, matching what every real course platform researched for
 * this leads with. The old list still exists below, now genuinely
 * secondary ("Also In Progress"), for whatever other courses a
 * trainee has touched.
 */
export default async function TraineeDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "TRAINEE") {
    redirect("/trainee/login");
  }

  const trainee = await prisma.trainee.findUnique({ where: { id: session.userId } });
  if (!trainee) redirect("/trainee/login");

  // M13 audit finding — see examEngine.ts's expireStaleAttemptsForTrainee
  // for the full reasoning: an attempt a trainee starts and never
  // returns to sits IN_PROGRESS forever with nothing to grade or
  // analyze it. This is the one place in the app already guaranteed to
  // run whenever a trainee actually comes back — best-effort, not a
  // guarantee (a trainee who never revisits the dashboard again still
  // won't get swept).
  await expireStaleAttemptsForTrainee(session.userId);

  const [publishedCourseCount, certificates] = await Promise.all([
    prisma.course.count({ where: { published: true } }),
    prisma.certificate.findMany({
      where: { traineeId: session.userId, revokedAt: null },
      select: { code: true, issuedAt: true, course: { select: { title: true } } },
      orderBy: { issuedAt: "desc" },
    }),
  ]);

  // Same "which courses has this trainee actually started" query as
  // GET /api/trainee/progress — see that route's own comment for why
  // this isn't just "every published course."
  const [attemptActivity, lessonActivity] = await Promise.all([
    prisma.attempt.findMany({
      where: { traineeId: session.userId, exam: { courseModule: { isNot: null } } },
      select: { startedAt: true, exam: { select: { courseModule: { select: { courseId: true } } } } },
    }),
    prisma.lessonProgress.findMany({
      where: { traineeId: session.userId },
      select: { completedAt: true, lesson: { select: { module: { select: { courseId: true } } } } },
    }),
  ]);

  const lastActivityByCourseId = new Map<string, Date>();
  for (const a of attemptActivity) {
    const courseId = a.exam.courseModule?.courseId;
    if (!courseId) continue;
    const existing = lastActivityByCourseId.get(courseId);
    if (!existing || a.startedAt > existing) lastActivityByCourseId.set(courseId, a.startedAt);
  }
  for (const l of lessonActivity) {
    const courseId = l.lesson.module.courseId;
    const existing = lastActivityByCourseId.get(courseId);
    if (!existing || l.completedAt > existing) lastActivityByCourseId.set(courseId, l.completedAt);
  }

  const courseIds = [...lastActivityByCourseId.keys()];
  const courses =
    courseIds.length === 0
      ? []
      : // M12 audit finding — same fix as GET /api/trainee/progress
        // (this page duplicates that route's query on purpose, see the
        // comment at the top of the file): filter to published courses
        // only, so an unpublished course a trainee once had activity in
        // doesn't show up here linking to a page that now 404s for them.
        await prisma.course.findMany({
          where: { id: { in: courseIds }, published: true },
          select: { id: true, title: true, modules: { select: { id: true } } },
        });

  const inProgress = (
    await Promise.all(
      courses.map(async (course: { id: string; title: string; modules: { id: string }[] }) => {
        const lockMap = await getModuleLockMap(course.id, session.userId);
        const totalModules = course.modules.length;
        const completedModules = Object.values(lockMap).filter((m) => m.completed).length;
        return {
          courseId: course.id,
          courseTitle: course.title,
          totalModules,
          completedModules,
          percentComplete: totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100),
          lastActivityAt: lastActivityByCourseId.get(course.id)!,
        };
      })
    )
  ).sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

  // Design-pass addition — the real "continue where you left off" hero
  // moment this whole redesign was built around. Only ever computed
  // for the single most-recently-active course, not every course in
  // the list — the point of a hero moment is one clear, confident
  // answer to "what should I do next," not the same detailed lookup
  // repeated for every course a trainee has ever touched.
  const topCourse = inProgress[0];
  const resumeTarget = topCourse ? await getResumeTarget(topCourse.courseId, session.userId) : null;
  const restOfInProgress = inProgress.slice(1);

  const hasNothingYet = inProgress.length === 0 && certificates.length === 0;

  // Time-of-day greeting — computed from the server's request time.
  // A small, honest touch: it makes the dashboard feel like it's
  // responding to *now*, not a static template. Deliberately simple
  // three-way split rather than trying to be clever about timezones
  // the server can't reliably know.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // A genuine momentum line, assembled only from real counts already
  // computed above — never an invented streak or estimate. Speaks to
  // whichever facts are actually true for this trainee, and stays
  // silent (null) when there's nothing real to say yet, so a brand-new
  // trainee doesn't get a hollow "0 courses" line.
  const certCount = certificates.length;
  const activeCount = inProgress.length;
  let momentumLine: string | null = null;
  if (certCount > 0 && activeCount > 0) {
    momentumLine = `${certCount} certificate${certCount === 1 ? "" : "s"} earned · ${activeCount} course${activeCount === 1 ? "" : "s"} in progress`;
  } else if (certCount > 0) {
    momentumLine = `${certCount} certificate${certCount === 1 ? "" : "s"} earned — keep the momentum going`;
  } else if (activeCount > 0) {
    momentumLine = `${activeCount} course${activeCount === 1 ? "" : "s"} in progress`;
  }

  return (
    <>
      <TraineeOnboarding shouldShow={!trainee.onboardingCompletedAt} />
      <SiteHeader
        nav={[
          { label: "Dashboard", href: "/trainee/dashboard" },
          { label: "Courses", href: "/trainee/courses" },
          { label: "My Downloads", href: "/trainee/downloads" },
          { label: "Introductions", href: "/trainee/introductions" },
          { label: "Job Board", href: "/trainee/job-postings" },
          { label: "Settings", href: "/trainee/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Design-pass — a warmer, more considered hero than a flat
            "Welcome, {name}". Time-of-day greeting (computed
            server-side from the request time) plus a genuine momentum
            line built only from real counts already on the page —
            earned certificates and active courses — never an invented
            or estimated "streak". The display serif is given room to
            breathe here (text-3xl, tighter tracking) since this is the
            first thing a trainee sees and the one place the brand's
            characterful Fraunces face should feel confident, not
            timid. */}
        <p className="text-sm font-medium text-brand-teal">{greeting}</p>
        <h1 className="mt-0.5 font-display text-3xl font-semibold tracking-tight text-brand-ink">
          {trainee.name}
        </h1>
        {momentumLine && <p className="mt-1.5 text-sm text-gray-600">{momentumLine}</p>}

        {!trainee.emailVerified && (
          <div className="mt-4 rounded-lg border border-brand-gold bg-brand-goldLight/50 px-4 py-3 text-sm text-brand-goldText">
            Your email isn&apos;t verified yet — check your inbox for the link we sent when you registered. Didn&apos;t
            get it? Check spam, or ask an admin for help.
          </div>
        )}

        {/* Design-pass addition — the real hero moment: one confident,
            prominent answer to "what should I do next," not another
            item in a list of equal-weight cards. Links directly to the
            exact next lesson or assessment (see getResumeTarget's own
            comment), falling back to the course page itself only when
            there's genuinely nothing more specific to resume — a
            trainee who just finished everything currently unlocked,
            for instance. */}
        {topCourse && (
          <Card variant="highlighted" className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Continue Learning</p>
            <p className="mt-1.5 font-display text-xl font-semibold text-brand-ink">{topCourse.courseTitle}</p>
            {resumeTarget && <p className="mt-1 text-sm text-gray-600">Next: {resumeTarget.label}</p>}
            <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-brand-teal transition-all"
                style={{ width: `${topCourse.percentComplete}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {topCourse.completedModules} of {topCourse.totalModules} module
              {topCourse.totalModules === 1 ? "" : "s"} complete
            </p>
            <Button href={resumeTarget?.url ?? `/trainee/courses/${topCourse.courseId}`} className="mt-4">
              Resume
            </Button>
          </Card>
        )}

        {hasNothingYet && (
          <div className="mt-8">
            <EmptyState
              illustration={<GrowthPathDoodle className="h-full w-full" />}
              title="Your learning journey starts here"
              description="Browse the courses available to you and start your first module — your progress will show up right here."
              action={
                <Button href="/trainee/courses" size="md">
                  Browse Courses
                </Button>
              }
            />
          </div>
        )}

        {/* Certificates trophy case — surfaced here because the
            dashboard is where a trainee lands most often, and earned
            credentials deserve better visibility than "only findable
            on the specific course page." Gold is used here on purpose
            — reserved across this whole redesign for exactly this
            kind of genuine-achievement moment. */}
        {certificates.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Your Certificates</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {certificates.map((cert: { code: string; issuedAt: Date; course: { title: string } }) => (
                <Link key={cert.code} href={`/certificate/${cert.code}`} target="_blank" rel="noopener noreferrer">
                  <Card variant="celebratory" interactive className="h-full">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        🎓
                      </span>
                      <div>
                        <p className="font-display text-sm font-semibold text-brand-ink">{cert.course.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          Issued {cert.issuedAt.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {restOfInProgress.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Also In Progress</h2>
            <div className="mt-3 space-y-3">
              {restOfInProgress.map((c) => (
                <Link key={c.courseId} href={`/trainee/courses/${c.courseId}`}>
                  <Card interactive className="hover:border-brand-teal">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm font-semibold text-brand-ink">{c.courseTitle}</span>
                      <span className="text-xs text-gray-500">
                        {c.completedModules} of {c.totalModules} module{c.totalModules === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full rounded-full bg-gray-100">
                      <div
                        className="h-1.5 rounded-full bg-brand-teal transition-all"
                        style={{ width: `${c.percentComplete}%` }}
                      />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!hasNothingYet && (
          <Card variant="highlighted" className="mt-8 flex items-center justify-between">
            <div>
              <p className="font-display text-base font-semibold text-brand-ink">
                {publishedCourseCount} course{publishedCourseCount === 1 ? "" : "s"} available
              </p>
              <p className="mt-1 text-sm text-gray-700">Browse course content — reading materials and lessons.</p>
            </div>
            <Button href="/trainee/courses">Browse Courses</Button>
          </Card>
        )}
      </main>
    </>
  );
}

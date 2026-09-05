import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { prisma } from "@/lib/prisma";

/**
 * Design-pass finding: this page was a straight leftover from the
 * original cbt-platform-scaffold (M1-M8) — still described the product
 * as an "AI-Powered CBT Examination Platform," still led with "Upload
 * questions. Build exams," and linked to the by-code exam flow as its
 * primary CTA. None of that has been true since M9 turned this into a
 * real LMS: courses, modules, progress locking, AI performance
 * feedback, and — the actual differentiator now — publicly verifiable
 * certificates. Rebuilt from scratch to describe what this product
 * actually is, using the same design system as the rest of this pass
 * (Fraunces for display type, the doodle illustrations, gold reserved
 * for the certificate/achievement theme).
 *
 * "Verify a Certificate" is a real, public-facing CTA here, not staff
 * plumbing — an employer or anyone else checking a trainee's
 * credential is a genuine visitor to this exact page, so it gets equal
 * billing with "Browse Courses," not buried in a footer link the way
 * "Staff Login" is.
 *
 * Testimonials — fetched directly via Prisma, not a client-side call
 * to /api/testimonials, matching the exact same server-component
 * pattern already established for /certificate/[code] and
 * /profile/[code]: this page has no reason to round-trip through its
 * own API when it can query directly, and doing so here means no
 * loading state or client-side fetch is needed for content that's the
 * same for every visitor. Real, staff-curated feedback — see the
 * Testimonial model's own comment on how these get here — not
 * unmoderated user-submitted reviews, matching this whole project's
 * established posture that nothing reaches a public audience without
 * a real human decision.
 */
export default async function LandingPage() {
  let testimonials: Array<{
    id: string;
    quote: string;
    traineeName: string;
    courseTitle: string | null;
    rating: number | null;
    courseReviewId: string | null;
    createdAt: Date;
  }> = [];
  try {
    testimonials = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
  } catch {
    testimonials = [];
  }

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Verify a Certificate", href: "/certificate" },
          { label: "Employer Login", href: "/employer/login" },
          { label: "Staff Login", href: "/admin/login" },
        ]}
      />
      <main>
        {/* Hero */}
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-teal">
            Africa&apos;s AI Capacity Building Initiative
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-brand-ink sm:text-5xl">
            Courses that end in a certificate anyone can verify.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-600">
            AAICBI trains Africa&apos;s next AI-capable workforce — cybersecurity, full-stack development, data
            analytics, and more — through structured courses, AI-graded assessments, and feedback after every
            attempt. Finish a course, and you walk away with a real, publicly verifiable credential.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="/trainee/courses" size="lg">
              Browse Courses
            </Button>
            <Button href="/certificate" variant="secondary" size="lg">
              Verify a Certificate
            </Button>
          </div>
        </section>

        {/* Feature grid */}
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Structured Courses", "Modules and lessons that unlock as you complete them — progress that's earned, not just watched."],
              ["AI-Graded Assessments", "Bank-backed, randomized questions with fair, instant grading every time."],
              ["Personalized Feedback", "After every assessment, AI analyzes your strengths and what to review next."],
              ["Verified Certificates", "Earn a real credential the moment you finish, with a public link anyone can check."],
            ].map(([title, desc]) => (
              <Card key={title}>
                <div className="font-display text-base font-semibold text-brand-teal">{title}</div>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Certificate showcase — the one other place gold appears
            besides the certificate page itself, since this section is
            specifically ABOUT that feature. */}
        <section className="border-t border-brand-gray bg-brand-sand/50">
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-6 py-16 sm:grid-cols-2">
            <div>
              <AchievementDoodle className="mx-auto h-32 w-32 sm:mx-0" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-brand-ink">
                A credential that holds up outside AAICBI, too.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                Every certificate gets a unique code and a public verification page — no login required. Anyone
                who wants to confirm a credential is genuine, an employer, a client, anyone, can check it in
                seconds.
              </p>
              <Link href="/certificate" className="mt-4 inline-block text-sm font-semibold text-brand-teal hover:underline">
                Verify a certificate →
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials — only ever rendered when at least one exists,
            not an empty section with a "nothing here yet" placeholder;
            a landing page with zero real testimonials should simply
            not claim to have any. */}
        {testimonials.length > 0 && (
          <section className="mx-auto max-w-5xl px-6 py-20">
            <h2 className="text-center font-display text-2xl font-semibold text-brand-ink">
              What trainees say
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t: (typeof testimonials)[number]) => (
                <Card key={t.id}>
                  {t.rating && (
                    <p className="mb-2" style={{ color: "#d4a017" }}>
                      {"★".repeat(t.rating)}
                      <span style={{ color: "#d1d5db" }}>{"★".repeat(5 - t.rating)}</span>
                    </p>
                  )}
                  <p className="text-sm leading-relaxed text-gray-700">&ldquo;{t.quote}&rdquo;</p>
                  <p className="mt-3 text-sm font-semibold text-brand-ink">{t.traineeName}</p>
                  {t.courseTitle && <p className="text-xs text-gray-500">{t.courseTitle}</p>}
                  <div className="mt-2 flex items-center gap-2">
                    {t.courseReviewId && <Badge variant="success">✓ Verified Trainee Review</Badge>}
                    <span className="text-xs text-gray-400">
                      {new Date(t.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Closing CTA */}
        <section className="mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
          <GrowthPathDoodle className="h-24 w-24" />
          <h2 className="mt-4 font-display text-2xl font-semibold text-brand-ink">Start where you are.</h2>
          <p className="mt-2 max-w-md text-sm text-gray-600">
            Browse what&apos;s available now, or sign in if you&apos;ve already started a course.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button href="/trainee/register" size="lg">
              Create an Account
            </Button>
            <Button href="/trainee/login" variant="ghost" size="lg">
              Sign In
            </Button>
          </div>
        </section>
      </main>
    </>
  );
}

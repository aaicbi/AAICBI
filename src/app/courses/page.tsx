import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicCourseMarketplacePage() {
  const [courses, testimonials] = await Promise.all([
    prisma.course.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { modules: true } },
      },
    }),
    prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }).catch(() => []),
  ]);

  const availableCourses = courses.filter((c) => !c.comingSoon);
  const comingSoonCourses = courses.filter((c) => c.comingSoon);

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Marketplace", href: "/courses" },
          { label: "Verify Certificate", href: "/certificate" },
          { label: "Sign In", href: "/trainee/login" },
        ]}
        right={
          <Button href="/trainee/register" size="sm">
            Get Started
          </Button>
        }
      />
      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Marketplace Header */}
        <section className="text-center max-w-3xl mx-auto py-8">
          <Badge variant="success">PUBLIC COURSE MARKETPLACE</Badge>
          <h1 className="mt-4 font-display text-4xl font-semibold text-brand-ink sm:text-5xl">
            Advance Your Career with Verified Training
          </h1>
          <p className="mt-4 text-base text-gray-600">
            Explore industry-aligned training programs built by expert instructors. Master new skills, complete practical assessments, and earn verifiable certificates.
          </p>
        </section>

        {/* Available Courses Section */}
        <section className="mt-10">
          <div className="flex items-center justify-between border-b border-brand-gray pb-4">
            <div>
              <h2 className="font-display text-2xl font-semibold text-brand-ink">Available Courses</h2>
              <p className="text-xs text-gray-500">Open for immediate enrollment and study.</p>
            </div>
            <Badge variant="neutral">{availableCourses.length} Available</Badge>
          </div>

          {availableCourses.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                illustration={<GrowthPathDoodle className="h-full w-full" />}
                title="No courses open for enrollment"
                description="Check back soon for newly published training programs."
              />
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {availableCourses.map((course) => (
                <Card key={course.id} className="flex flex-col justify-between overflow-hidden p-0">
                  <div>
                    {course.imageUrl ? (
                      <div className="h-44 w-full overflow-hidden bg-brand-sand">
                        <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-brand-sand/60 text-brand-teal font-display font-semibold text-lg">
                        {course.title.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2">
                        {course.isFree ? (
                          <Badge variant="neutral">FREE</Badge>
                        ) : (
                          <Badge variant="success">PAID</Badge>
                        )}
                        <span className="text-xs text-gray-500">
                          {course.estimatedDuration ?? `${course._count.modules} modules`}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-semibold text-brand-ink hover:text-brand-teal transition-colors">
                        <Link href={`/courses/${course.id}`}>{course.title}</Link>
                      </h3>
                      {course.description && (
                        <p className="mt-2 line-clamp-3 text-xs text-gray-600">{course.description}</p>
                      )}
                      <p className="mt-3 text-xs text-gray-400">By {course.createdBy.name} · AAICBI</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-brand-gray px-5 py-4 bg-gray-50/50">
                    <div>
                      {course.isFree ? (
                        <span className="font-display font-semibold text-brand-teal">Free</span>
                      ) : (
                        <span className="font-display font-semibold text-brand-ink">
                          ₦{((course.priceKobo ?? 0) / 100).toLocaleString()}
                          {course.billingInterval && (
                            <span className="text-xs font-normal text-gray-500">/{course.billingInterval.toLowerCase()}</span>
                          )}
                        </span>
                      )}
                    </div>
                    <Button href={`/courses/${course.id}`} size="sm">
                      View Details →
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Coming Soon Section */}
        {comingSoonCourses.length > 0 && (
          <section className="mt-16">
            <div className="flex items-center justify-between border-b border-brand-gray pb-4">
              <div>
                <h2 className="font-display text-2xl font-semibold text-brand-ink">Coming Soon</h2>
                <p className="text-xs text-gray-500">Upcoming courses currently in development.</p>
              </div>
              <Badge variant="warning">COMING SOON</Badge>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {comingSoonCourses.map((course) => (
                <Card key={course.id} className="flex flex-col justify-between overflow-hidden p-0 opacity-90">
                  <div>
                    {course.imageUrl ? (
                      <div className="h-44 w-full overflow-hidden bg-brand-sand">
                        <img src={course.imageUrl} alt={course.title} className="h-full w-full object-cover grayscale" />
                      </div>
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-gray-100 text-gray-400 font-display font-semibold text-lg">
                        COMING SOON
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="warning">COMING SOON</Badge>
                        <span className="text-xs text-gray-400">{course.estimatedDuration ?? "Upcoming"}</span>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-semibold text-gray-700">{course.title}</h3>
                      {course.description && (
                        <p className="mt-2 line-clamp-3 text-xs text-gray-500">{course.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-brand-gray px-5 py-4 bg-gray-50/50">
                    <span className="text-xs text-gray-500">Enrollment opens soon</span>
                    <Button href={`/courses/${course.id}`} variant="secondary" size="sm">
                      Preview Course
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Student Testimonials Section */}
        {testimonials.length > 0 && (
          <section className="mt-20 border-t border-brand-gray pt-12">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="font-display text-3xl font-semibold text-brand-ink">What Our Trainees Say</h2>
              <p className="mt-2 text-xs text-gray-600">
                Verified reviews and feedback from graduates who completed training with AAICBI.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <Card key={t.id} className="flex flex-col justify-between">
                  <div>
                    {t.rating && (
                      <div className="mb-2 text-brand-gold text-sm">
                        {"★".repeat(t.rating)}
                        <span className="text-gray-300">{"★".repeat(5 - t.rating)}</span>
                      </div>
                    )}
                    <p className="text-xs leading-relaxed text-gray-700">&ldquo;{t.quote}&rdquo;</p>
                  </div>
                  <div className="mt-4 border-t border-brand-gray/50 pt-3">
                    <p className="text-xs font-semibold text-brand-ink">{t.traineeName}</p>
                    {t.courseTitle && <p className="text-[11px] text-gray-500">{t.courseTitle}</p>}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

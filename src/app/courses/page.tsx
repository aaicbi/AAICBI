"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import UpcomingCourseCard, { type UpcomingCourseRow } from "@/components/courses/UpcomingCourseCard";
import PriceTag from "@/components/courses/PriceTag";
import { CalendarClock, ArrowRight, Search } from "lucide-react";
import { trackVisitorEvent } from "@/lib/analytics/visitorTrackClient";

interface PublicCourseRow extends UpcomingCourseRow {
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | null;
  moduleCount: number;
}

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };

// Coming Soon Courses — only these phases read as genuinely "coming
// soon" for the carousel; STARTED/COMPLETED courses fall through to
// the ordinary "Available Courses" list below unchanged, exactly like
// any course that never set schedule fields at all.
const UPCOMING_PHASES = new Set(["COMING_SOON", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"]);

/**
 * /courses — the genuinely public course catalogue, reachable by
 * anyone with no login at all. This is what the landing page's
 * "Browse Courses" button now points to — previously that button led
 * to /trainee/courses, which forced a login wall before a visitor saw
 * anything. Fed by the anonymous GET /api/courses/public.
 */
export default function PublicCoursesPage() {
  const [courses, setCourses] = useState<PublicCourseRow[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    trackVisitorEvent({ type: "PAGE_VIEWED", path: "/courses" });
    fetch("/api/courses/public")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCourses)
      .catch(() => setCourses([]));
  }, []);

  // Analytics System Phase 3 — the one real search feature Search
  // Intelligence needs to exist at all. Filters the already-fetched
  // list client-side (no backend search index needed at this course
  // count) and fires a debounced SEARCH_PERFORMED beacon ~600ms after
  // typing pauses — not on every keystroke, which would flood the
  // endpoint and make "what did someone search for" noise rather than
  // signal.
  const trimmedQuery = query.trim();
  const searchResults = trimmedQuery
    ? (courses ?? []).filter((c) => {
        const haystack = `${c.title} ${c.description ?? ""} ${c.category ?? ""}`.toLowerCase();
        return haystack.includes(trimmedQuery.toLowerCase());
      })
    : null;

  useEffect(() => {
    if (!trimmedQuery || courses === null) return;
    const timer = setTimeout(() => {
      trackVisitorEvent({ type: "SEARCH_PERFORMED", searchQuery: trimmedQuery, resultCount: searchResults?.length ?? 0 });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmedQuery, courses]);

  // Coming Soon Courses — a course only ever appears in one of the two
  // sections below, never both: genuinely "coming soon"-flavored
  // phases go in the carousel, everything else (no schedule at all,
  // already STARTED, or COMPLETED) is an ordinary available course,
  // exactly as before this feature existed.
  const upcomingCourses = (courses ?? [])
    .filter((c) => c.lifecyclePhase && UPCOMING_PHASES.has(c.lifecyclePhase))
    .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
  const availableCourses = (courses ?? []).filter((c) => !c.lifecyclePhase || !UPCOMING_PHASES.has(c.lifecyclePhase));

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Community Showcase", href: "/showcase" },
          { label: "Trainee Login", href: "/trainee/login" },
          { label: "Employer Login", href: "/employer/login" },
          { label: "Staff Login", href: "/admin/login" },
        ]}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Courses</h1>
        <p className="mt-1 text-sm text-gray-500">Browse what&apos;s available — sign up when you&apos;re ready to enroll.</p>

        <div className="relative mt-6 max-w-md">
          <Icon icon={Search} size="sm" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses…"
            aria-label="Search courses"
            className="w-full rounded-lg border border-brand-gray py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-teal"
          />
        </div>

        {searchResults !== null ? (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-brand-ink">
              {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for &ldquo;{trimmedQuery}&rdquo;
            </h2>
            {searchResults.length === 0 ? (
              <div className="mt-6">
                <EmptyState title="No courses matched" description="Try a different search term, or browse everything below." />
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {searchResults.map((course) => (
                  <a key={course.id} href={`/courses/${course.id}`}>
                    <Card interactive className="flex items-center gap-4 hover:border-brand-teal">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display font-semibold text-brand-ink">{course.title}</span>
                          {course.isFree && <Badge variant="success">Free</Badge>}
                        </div>
                        {course.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{course.description}</p>}
                        {course.category && <p className="mt-1 text-xs text-gray-500">{course.category}</p>}
                      </div>
                    </Card>
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="mt-10 font-display text-lg font-semibold text-brand-ink">Available Courses</h2>

            {/* Explicit 216px (72px + a further +144px) per direct request —
                not on Tailwind's default spacing scale, hence the
                arbitrary-value syntax rather than a named step. */}
            <div className="mt-8 space-y-[216px]">
              {courses === null && <SkeletonList rows={4} />}
              {courses?.length === 0 && <EmptyState title="No courses available yet" description="Check back soon." />}

              {availableCourses.map((course) => (
                <a key={course.id} href={`/courses/${course.id}`}>
                  <Card interactive className="flex items-center gap-4 hover:border-brand-teal">
                    {course.flyerUrl && (
                      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-brand-mint">
                        {/* eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL. */}
                        <img src={course.flyerUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-semibold text-brand-ink">{course.title}</span>
                        {course.isFree && <Badge variant="success">Free</Badge>}
                        {course.level && <Badge variant="neutral">{LEVEL_LABEL[course.level]}</Badge>}
                      </div>
                      {course.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{course.description}</p>}
                      {!course.isFree && course.priceKobo != null && (
                        <div className="mt-1.5">
                          <PriceTag
                            priceKobo={course.priceKobo}
                            discountPercent={course.discountPercent}
                            effectivePriceKobo={course.effectivePriceKobo}
                            billingInterval={course.billingInterval}
                            size="sm"
                          />
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        {course.category && `${course.category} · `}
                        {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </Card>
                </a>
              ))}
            </div>

            {/* Coming Soon Courses — a horizontal carousel of upcoming
                courses, sorted soonest-first, positioned below the existing
                Available Courses list per direct request. Links out to the
                dedicated /courses/upcoming page for the full list. */}
            {upcomingCourses.length > 0 && (
              <div className="mt-16">
                <div className="flex items-baseline justify-between">
                  <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-brand-ink">
                    <Icon icon={CalendarClock} size="sm" className="text-brand-gold" />
                    Upcoming Courses
                  </h2>
                  <a
                    href="/courses/upcoming"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-teal hover:underline"
                  >
                    See all upcoming <Icon icon={ArrowRight} size="sm" />
                  </a>
                </div>
                <div className="mt-4 flex snap-x gap-4 overflow-x-auto pb-4">
                  {upcomingCourses.map((course) => (
                    <div key={course.id} className="w-64 shrink-0 snap-start">
                      <UpcomingCourseCard course={course} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

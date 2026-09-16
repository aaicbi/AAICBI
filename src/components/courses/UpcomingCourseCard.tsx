import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import { CalendarDays, Clock, Tag, MapPin, BookOpen } from "lucide-react";
import { COURSE_LIFECYCLE_PHASE_LABEL, COURSE_LIFECYCLE_PHASE_BADGE_VARIANT } from "@/lib/courseLifecycle";

export interface UpcomingCourseRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  durationDisplay: string | null;
  isFree: boolean;
  priceKobo: number | null;
  billingInterval: "MONTHLY" | "QUARTERLY" | "ANNUALLY" | null;
  flyerUrl: string | null;
  startDate: string | null;
  locationType: "PHYSICAL" | "ONLINE" | "HYBRID" | null;
  venue: string | null;
  lifecyclePhase: "COMING_SOON" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "STARTED" | "COMPLETED" | null;
}

const LOCATION_LABEL: Record<string, string> = { PHYSICAL: "Physical", ONLINE: "Online", HYBRID: "Hybrid" };

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function formatPrice(priceKobo: number | null, billingInterval: string | null): string {
  if (priceKobo == null) return "";
  const naira = (priceKobo / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
  const interval = billingInterval === "MONTHLY" ? "/month" : billingInterval === "QUARTERLY" ? "/quarter" : billingInterval === "ANNUALLY" ? "/year" : "";
  return `${naira}${interval}`;
}

/**
 * Coming Soon Courses — the "advertisement card" shared by the
 * catalogue page's carousel and the dedicated /courses/upcoming grid,
 * so the two surfaces can never drift apart on what a course card
 * actually shows. Reuses the existing Badge/Icon components and the
 * app's real card shape (rounded-xl border shadow-sm) rather than
 * inventing new primitives.
 */
export default function UpcomingCourseCard({ course }: { course: UpcomingCourseRow }) {
  const registrationOpen = course.lifecyclePhase === "REGISTRATION_OPEN";

  return (
    <a
      href={`/courses/${course.id}`}
      className="flex w-full flex-col overflow-hidden rounded-xl border border-brand-gray bg-brand-surface shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-brand-mint to-brand-teal/20">
        {course.flyerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL.
          <img src={course.flyerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon icon={BookOpen} size="xl" className="text-brand-teal/40" />
        )}
        {course.lifecyclePhase && (
          <span className="absolute left-2.5 top-2.5">
            <Badge variant={COURSE_LIFECYCLE_PHASE_BADGE_VARIANT[course.lifecyclePhase]}>
              {COURSE_LIFECYCLE_PHASE_LABEL[course.lifecyclePhase]}
            </Badge>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-base font-semibold leading-snug text-brand-ink">{course.title}</h3>
        {course.description && <p className="line-clamp-2 text-xs text-gray-600">{course.description}</p>}

        <div className="mt-1 flex flex-col gap-1 text-xs text-gray-600">
          {course.startDate && (
            <span className="flex items-center gap-1.5">
              <Icon icon={CalendarDays} size="sm" /> Starts {formatDate(course.startDate)}
            </span>
          )}
          {course.durationDisplay && (
            <span className="flex items-center gap-1.5">
              <Icon icon={Clock} size="sm" /> {course.durationDisplay}
            </span>
          )}
          {course.locationType && (
            <span className="flex items-center gap-1.5">
              <Icon icon={MapPin} size="sm" /> {LOCATION_LABEL[course.locationType] ?? course.locationType}
              {course.venue ? ` — ${course.venue}` : ""}
            </span>
          )}
          {course.category && (
            <span className="flex items-center gap-1.5">
              <Icon icon={Tag} size="sm" /> {course.category}
            </span>
          )}
        </div>

        <div className="mt-1 font-display text-base font-semibold text-brand-ink">
          {course.isFree ? "Free" : formatPrice(course.priceKobo, course.billingInterval)}
        </div>

        <div className="mt-2 flex gap-2">
          <span className="flex-1 rounded-lg border border-brand-gray px-3 py-2 text-center text-xs font-semibold text-brand-ink">
            View Course
          </span>
          {registrationOpen && (
            <span className="flex-1 rounded-lg bg-brand-teal px-3 py-2 text-center text-xs font-semibold text-white">
              Register Now
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

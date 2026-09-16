"use client";
import { useState, type ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import CourseOutlineAccordion from "@/components/courses/CourseOutlineAccordion";
import CourseFlyerLightbox from "@/components/courses/CourseFlyerLightbox";
import type { MarketingView } from "@/lib/courseMarketing";
import { COURSE_LIFECYCLE_PHASE_LABEL, COURSE_LIFECYCLE_PHASE_BADGE_VARIANT } from "@/lib/courseLifecycle";
import Icon from "@/components/ui/Icon";
import { CheckCircle2, FileText, Download } from "lucide-react";

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const FORMAT_LABEL: Record<string, string> = {
  SELF_PACED: "Self-paced / Online",
  INSTRUCTOR_LED: "Instructor-led",
  HYBRID: "Hybrid",
};
const LOCATION_LABEL: Record<string, string> = { PHYSICAL: "Physical", ONLINE: "Online", HYBRID: "Hybrid" };

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

function formatPrice(priceKobo: number | null, billingInterval: string | null): string {
  if (priceKobo == null) return "";
  const naira = (priceKobo / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
  const interval = billingInterval === "MONTHLY" ? "/month" : billingInterval === "QUARTERLY" ? "/quarter" : billingInterval === "ANNUALLY" ? "/year" : "";
  return `${naira}${interval}`;
}

/**
 * Course catalogue upgrade — the one shared presentational component
 * behind every "here's what this course is, before you commit" view:
 * the logged-in-but-unenrolled trainee page, the genuinely public
 * catalogue page, and the staff preview-as-trainee page all render
 * this exact component from the same `buildMarketingView` shape, with
 * only the `actions` slot (Enroll/Pay, a login prompt, or nothing for
 * a staff preview) differing per caller.
 *
 * Organized into clear, separately-scannable sections rather than one
 * long scroll of text — hero, about, what you'll learn, outline,
 * what to expect, requirements, audience, curriculum, flyer — matching
 * the "organize into clear sections... don't overwhelm" brief.
 */
export default function CourseMarketingView({ data, actions }: { data: MarketingView; actions?: ReactNode }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Hero */}
      <div className="flex flex-col gap-6 sm:flex-row">
        {data.flyerUrl && (
          <button
            onClick={() => setLightboxOpen(true)}
            className="h-40 w-full shrink-0 overflow-hidden rounded-xl border border-brand-gray sm:w-56"
            aria-label="View full-size flyer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a real, dynamically-uploaded external URL. */}
            <img src={data.flyerUrl} alt={`${data.title} flyer`} className="h-full w-full object-cover" />
          </button>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {data.lifecyclePhase && (
              <Badge variant={COURSE_LIFECYCLE_PHASE_BADGE_VARIANT[data.lifecyclePhase]}>
                {COURSE_LIFECYCLE_PHASE_LABEL[data.lifecyclePhase]}
              </Badge>
            )}
            {data.isFree && <Badge variant="success">Free</Badge>}
            {data.level && <Badge variant="neutral">{LEVEL_LABEL[data.level] ?? data.level}</Badge>}
          </div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-brand-ink">{data.title}</h1>
          {data.description && <p className="mt-2 text-sm text-gray-600">{data.description}</p>}

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            {data.durationDisplay && (
              <div>
                <dt className="text-xs text-gray-500">Duration</dt>
                <dd className="font-semibold text-brand-ink">{data.durationDisplay}</dd>
              </div>
            )}
            {data.trainingFormat && (
              <div>
                <dt className="text-xs text-gray-500">Format</dt>
                <dd className="font-semibold text-brand-ink">{FORMAT_LABEL[data.trainingFormat] ?? data.trainingFormat}</dd>
              </div>
            )}
            {data.instructorNames && (
              <div>
                <dt className="text-xs text-gray-500">Instructor</dt>
                <dd className="font-semibold text-brand-ink">{data.instructorNames}</dd>
              </div>
            )}
            {!data.isFree && data.priceKobo != null && (
              <div>
                <dt className="text-xs text-gray-500">Price</dt>
                <dd className="font-semibold text-brand-ink">{formatPrice(data.priceKobo, data.billingInterval)}</dd>
              </div>
            )}
            {data.startDate && (
              <div>
                <dt className="text-xs text-gray-500">Starts</dt>
                <dd className="font-semibold text-brand-ink">{formatDate(data.startDate)}</dd>
              </div>
            )}
            {data.registrationDeadline && (
              <div>
                <dt className="text-xs text-gray-500">Registration deadline</dt>
                <dd className="font-semibold text-brand-ink">{formatDate(data.registrationDeadline)}</dd>
              </div>
            )}
            {data.locationType && (
              <div>
                <dt className="text-xs text-gray-500">Location</dt>
                <dd className="font-semibold text-brand-ink">
                  {LOCATION_LABEL[data.locationType] ?? data.locationType}
                  {data.venue ? ` — ${data.venue}` : ""}
                </dd>
              </div>
            )}
          </dl>

          {data.capacity != null && (
            <p className="mt-2 text-xs text-gray-500">
              {data.enrolledCount} of {data.capacity} seat{data.capacity === 1 ? "" : "s"} registered
            </p>
          )}

          {actions && <div className="mt-5">{actions}</div>}
        </div>
      </div>

      {/* About */}
      {data.description && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">About this course</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{data.description}</p>
        </section>
      )}

      {/* What you'll learn */}
      {(data.skillsGained.length > 0 || data.learningOutcomes.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">What you&apos;ll learn</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {[...data.learningOutcomes, ...data.skillsGained].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <Icon icon={CheckCircle2} size="sm" className="mt-0.5 shrink-0 text-brand-teal" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Course outline */}
      {data.modules.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Course outline</h2>
          <div className="mt-2">
            <CourseOutlineAccordion modules={data.modules} />
          </div>
        </section>
      )}

      {/* What to expect */}
      {data.whatToExpect.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">What to expect</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {data.whatToExpect.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-0.5 text-brand-teal">•</span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Requirements */}
      {data.prerequisites.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Requirements</h2>
          <ul className="mt-2 space-y-1.5">
            {data.prerequisites.map((item, i) => (
              <li key={i} className="text-sm text-gray-700">
                — {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Who this is for */}
      {data.targetAudience && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Who this course is for</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">{data.targetAudience}</p>
        </section>
      )}

      {/* Curriculum */}
      {(data.curriculumUrl || data.modules.length > 0) && (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold text-brand-ink">Course curriculum</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {data.curriculumUrl && (
              <a
                href={data.curriculumUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-tealDeep"
              >
                <Icon icon={FileText} size="sm" /> Download Curriculum
              </a>
            )}
            {/* Additive, independent of the admin-uploaded document above
                — a real PDF generated on demand from this course's own
                module/lesson outline, so every course with a curriculum
                has something downloadable even if no document was ever
                manually uploaded. */}
            {data.modules.length > 0 && (
              <a
                href={`/api/courses/${data.id}/curriculum-pdf`}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-gray px-5 py-2.5 text-sm font-semibold text-brand-ink hover:border-brand-teal hover:text-brand-teal"
              >
                <Icon icon={Download} size="sm" /> Download Course Outline (PDF)
              </a>
            )}
          </div>
        </section>
      )}

      {data.flyerUrl && (
        <CourseFlyerLightbox open={lightboxOpen} flyerUrl={data.flyerUrl} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}

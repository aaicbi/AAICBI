/**
 * Course catalogue upgrade — the single shape-builder behind every
 * pre-enrollment/pre-decision view of a course: the trainee-authenticated
 * "not enrolled yet" response (courses/[id]/route.ts), the staff
 * preview-as-trainee route, and the genuinely public catalogue detail
 * route all call this same pure function, so the three surfaces can
 * never quietly drift apart on what a prospective trainee is and isn't
 * shown.
 *
 * Pure — no Prisma import, no network — matching this project's
 * "pure core, testable without I/O" split (coursePricing.ts,
 * billingPeriod.ts). Every visibility toggle is applied here, in one
 * place, and — regardless of any toggle — module/lesson `description`,
 * any `materials`, `createdBy`, and any progress/attempt/certificate/
 * enrollment data are NEVER included. That's not a toggle; it's the
 * one thing this function structurally cannot leak.
 *
 * Coming Soon Courses — the schedule fields have no show* toggle of
 * their own (unlike flyer/curriculum/outline etc. above): a course
 * with no startDate simply has nothing to show, and one WITH a
 * startDate is specifically being advertised as upcoming, so there's
 * no scenario where an admin would want the dates hidden while still
 * wanting the course itself visible. `lifecyclePhase` is computed
 * once, here, via getCourseLifecyclePhase — the single source of
 * truth every caller reads, rather than each of the three call sites
 * recomputing it themselves.
 */
import { getCourseLifecyclePhase } from "@/lib/courseLifecycle";
import type { CourseLifecyclePhase, CourseLocationType } from "@prisma/client";

export interface MarketingSourceCourse {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  priceKobo: number | null;
  billingInterval: string | null;
  category: string | null;
  level: string | null;
  durationDisplay: string | null;
  trainingFormat: string | null;
  instructorNames: string | null;
  flyerUrl: string | null;
  curriculumUrl: string | null;
  curriculumUploadedAt: Date | string | null;
  skillsGained: string[];
  learningOutcomes: string[];
  whatToExpect: string[];
  prerequisites: string[];
  targetAudience: string | null;
  showFlyer: boolean;
  showCurriculumDownload: boolean;
  showWhatYoullLearn: boolean;
  showWhatToExpect: boolean;
  showRequirements: boolean;
  showAudience: boolean;
  showOutline: boolean;
  modules: { id: string; title: string; lessons: { id: string; title: string }[] }[];
  // Coming Soon Courses
  startDate: Date | string | null;
  endDate: Date | string | null;
  registrationDeadline: Date | string | null;
  locationType: CourseLocationType | null;
  venue: string | null;
  capacity: number | null;
  lifecyclePhaseOverride: CourseLifecyclePhase | null;
  _count: { courseEnrollments: number };
}

export interface MarketingView {
  id: string;
  title: string;
  description: string | null;
  isFree: boolean;
  priceKobo: number | null;
  billingInterval: string | null;
  category: string | null;
  level: string | null;
  durationDisplay: string | null;
  trainingFormat: string | null;
  instructorNames: string | null;
  flyerUrl: string | null;
  curriculumUrl: string | null;
  curriculumUploadedAt: Date | string | null;
  skillsGained: string[];
  learningOutcomes: string[];
  whatToExpect: string[];
  prerequisites: string[];
  targetAudience: string | null;
  modules: { id: string; title: string; lessons: { id: string; title: string }[] }[];
  // Coming Soon Courses
  startDate: Date | string | null;
  endDate: Date | string | null;
  registrationDeadline: Date | string | null;
  locationType: CourseLocationType | null;
  venue: string | null;
  capacity: number | null;
  enrolledCount: number;
  lifecyclePhase: CourseLifecyclePhase | null;
}

export function buildMarketingView(course: MarketingSourceCourse): MarketingView {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    isFree: course.isFree,
    priceKobo: course.priceKobo,
    billingInterval: course.billingInterval,
    category: course.category,
    level: course.level,
    durationDisplay: course.durationDisplay,
    trainingFormat: course.trainingFormat,
    instructorNames: course.instructorNames,
    flyerUrl: course.showFlyer ? course.flyerUrl : null,
    curriculumUrl: course.showCurriculumDownload ? course.curriculumUrl : null,
    curriculumUploadedAt: course.showCurriculumDownload ? course.curriculumUploadedAt : null,
    skillsGained: course.showWhatYoullLearn ? course.skillsGained : [],
    learningOutcomes: course.showWhatYoullLearn ? course.learningOutcomes : [],
    whatToExpect: course.showWhatToExpect ? course.whatToExpect : [],
    prerequisites: course.showRequirements ? course.prerequisites : [],
    targetAudience: course.showAudience ? course.targetAudience : null,
    modules: course.showOutline
      ? course.modules.map((m) => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons.map((l) => ({ id: l.id, title: l.title })),
        }))
      : [],
    startDate: course.startDate,
    endDate: course.endDate,
    registrationDeadline: course.registrationDeadline,
    locationType: course.locationType,
    venue: course.venue,
    capacity: course.capacity,
    enrolledCount: course._count.courseEnrollments,
    lifecyclePhase: getCourseLifecyclePhase(course),
  };
}

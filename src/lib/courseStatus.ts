/**
 * Course catalogue upgrade — the single source of truth for "is this
 * course publicly visible," now that a course has five real states
 * instead of one boolean. Every one of the 17 real Course.published
 * call sites found during this feature's audit reads this instead of
 * the raw (now-deprecated) boolean.
 *
 * Deliberately preserves the original gating behavior for four of the
 * five states: only PUBLISHED is visible, and DRAFT/UNPUBLISHED/
 * ARCHIVED are all treated identically to the old published: false.
 *
 * UNLISTED is the one deliberate exception to that invariant, added
 * for private/cohort-only courses: it stays excluded from every
 * catalog/browse surface (this function still returns false for it,
 * correctly), but it must NOT block an already-admin-granted trainee
 * from reaching the course's actual content the way DRAFT/UNPUBLISHED/
 * ARCHIVED correctly do. That wider, trainee-aware check lives in
 * canTraineeAccessCourse (src/lib/courseAccess.ts) — every trainee-
 * content route should call that, not this function, when a specific
 * trainee (not an anonymous catalog listing) is asking "can I see
 * this." This function alone still answers exactly one question —
 * "does this belong in the public catalog" — correctly for all five
 * states.
 */
import type { CourseStatus } from "@prisma/client";

export function isCoursePubliclyVisible(status: CourseStatus): boolean {
  return status === "PUBLISHED";
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
  UNLISTED: "Unlisted",
  ARCHIVED: "Archived",
};

export const COURSE_STATUS_BADGE_VARIANT: Record<CourseStatus, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
  // Matches DRAFT's understated treatment — an intentional, healthy
  // state, not something success/warning/danger would represent
  // honestly. `gold` stays reserved for the certificate moment (see
  // that page's own comment on why that restraint matters) rather than
  // being spent here.
  UNLISTED: "neutral",
  ARCHIVED: "danger",
};

export const COURSE_STATUS_VALUES: CourseStatus[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "UNLISTED", "ARCHIVED"];

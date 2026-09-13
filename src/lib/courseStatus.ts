/**
 * Course catalogue upgrade — the single source of truth for "is this
 * course publicly visible," now that a course has four real states
 * instead of one boolean. Every one of the 17 real Course.published
 * call sites found during this feature's audit reads this instead of
 * the raw (now-deprecated) boolean.
 *
 * Deliberately preserves today's exact gating behavior: only
 * PUBLISHED is visible. DRAFT/UNPUBLISHED/ARCHIVED are all treated
 * identically to the old published: false — including the existing,
 * slightly sharp edge that unpublishing already blocks even an
 * already-enrolled trainee from viewing the course. This feature adds
 * a richer vocabulary for admins, not new gating semantics.
 */
import type { CourseStatus } from "@prisma/client";

export function isCoursePubliclyVisible(status: CourseStatus): boolean {
  return status === "PUBLISHED";
}

export const COURSE_STATUS_LABEL: Record<CourseStatus, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
  ARCHIVED: "Archived",
};

export const COURSE_STATUS_BADGE_VARIANT: Record<CourseStatus, "success" | "warning" | "danger" | "neutral"> = {
  DRAFT: "neutral",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
  ARCHIVED: "danger",
};

export const COURSE_STATUS_VALUES: CourseStatus[] = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"];

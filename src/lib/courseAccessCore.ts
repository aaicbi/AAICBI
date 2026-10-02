/**
 * Free preview modules — the pure "is this module's rank within the
 * course's free-preview window" rule, extracted so it's unit-testable
 * without a live database and shared by its two real callers
 * (getModuleAccessLevel in courseAccess.ts, and GET /api/courses/[id]'s
 * own module-shaping loop) instead of two independently-maintained
 * copies of the same clamp-and-compare logic.
 *
 * `moduleIndex` is the module's position in the course's modules
 * ordered by `order` ascending (0-indexed) — a RANK, not the raw
 * `order` value itself, so gaps in `order` never matter.
 *
 * Clamped to `totalModules - 1` so a course can never end up with
 * every module previewable, even if `freePreviewModuleCount` was saved
 * before a module was later removed — the same defensive guarantee the
 * admin-side save validation already enforces at write time, re-applied
 * here at read time in case the two ever drift.
 */
export function isModuleIndexInFreePreview(
  moduleIndex: number,
  freePreviewModuleCount: number | null | undefined,
  totalModules: number
): boolean {
  if (!freePreviewModuleCount || moduleIndex < 0) return false;
  const effectiveCount = Math.min(freePreviewModuleCount, Math.max(0, totalModules - 1));
  return moduleIndex < effectiveCount;
}

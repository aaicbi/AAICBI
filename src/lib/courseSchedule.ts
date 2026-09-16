/**
 * Coming Soon Courses — the one cross-field validation the new
 * schedule fields need, following coursePricing.ts's own precedent: a
 * pure function shared by the update route (and unit-testable on its
 * own), not a Zod `.refine()` duplicated anywhere else this ever needs
 * checking.
 */
export function validateCourseSchedule(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  registrationDeadline: Date | null | undefined
): string | null {
  if (registrationDeadline != null && startDate != null && registrationDeadline > startDate) {
    return "Registration deadline can't be after the course start date.";
  }
  if (startDate != null && endDate != null && startDate > endDate) {
    return "Course start date can't be after the course end date.";
  }
  return null;
}

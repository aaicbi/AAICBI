import { prisma } from "@/lib/prisma";

/**
 * Training Organizations, Phase 2 — the reverse lookup that makes the
 * shadow-staff-account pattern (TrainingOrganization.staffUserId, see
 * its own schema comment) usable from the admin side: given a `User.id`
 * that might be one of these dedicated, login-disabled accounts, finds
 * the organization it belongs to. Returns null for every real staff
 * member (SUPER_ADMIN/ADMIN/INSTRUCTOR) — they were never assigned as
 * anyone's staffUserId — so every call site below behaves identically
 * for real staff, completely unchanged.
 *
 * Reused in three places: the admin sidebar (cosmetic restriction), the
 * three admin routes that had no per-creator scoping at all (real
 * guard), and the Paystack payment flow (resolving a course's own
 * organization, given the OTHER direction — its createdById).
 */
export function findTrainingOrgByStaffUserId(userId: string) {
  return prisma.trainingOrganization.findFirst({ where: { staffUserId: userId } });
}

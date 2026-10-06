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

/**
 * Certificate editor opened to org admins — the same ownership-check
 * convention as courseOwnership.ts's requireOwnedCourse/Module/Lesson/
 * Material (resolve, 403/404 if the session doesn't own it, explicit
 * SUPER_ADMIN bypass), applied here to "does this ADMIN session's own
 * organization match the training org a certificate-template route is
 * acting on." Call after requireRole("SUPER_ADMIN", "ADMIN") — this
 * only narrows an already-authenticated ADMIN session down to its own
 * organization; it never authenticates on its own.
 */
export async function requireTrainingOrgAccess(trainingOrgId: string, session: { userId: string; role: string }): Promise<void> {
  if (session.role === "SUPER_ADMIN") return;
  const forbidden = () => {
    const err = new Error("Not authorized for this organization.") as Error & { status?: number };
    err.status = 403;
    return err;
  };
  if (session.role !== "ADMIN") throw forbidden();
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org || org.id !== trainingOrgId) throw forbidden();
}

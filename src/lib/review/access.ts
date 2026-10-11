import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export interface ReviewerIdentity {
  userId: string;
  name: string;
  isSuperAdmin: boolean;
}

function httpError(status: number, message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = status;
  return err;
}

/**
 * The signed-in super admin, or a staff member the super admin has made a
 * reviewer. Checked on the server for every review action. A training
 * organization's own staff account is never a reviewer.
 */
export async function requireReviewer(): Promise<ReviewerIdentity> {
  const session = await getSession();
  if (!session) throw httpError(401, "Not authenticated.");
  if (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN" && session.role !== "INSTRUCTOR") throw httpError(403, "Forbidden.");
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true, role: true, active: true, canReview: true, trainingOrgAsStaffUser: { select: { id: true } } } });
  if (!user || !user.active) throw httpError(403, "Forbidden.");
  if (user.role === "SUPER_ADMIN") return { userId: session.userId, name: user.name, isSuperAdmin: true };
  if (user.canReview && !user.trainingOrgAsStaffUser) return { userId: session.userId, name: user.name, isSuperAdmin: false };
  throw httpError(403, "You are not a reviewer. Ask a super admin for reviewer access.");
}

/** For navigation: does this signed-in staff member see the review inbox? */
export async function canReviewUser(userId: string, role: string): Promise<boolean> {
  if (role === "SUPER_ADMIN") return true;
  if (role !== "ADMIN" && role !== "INSTRUCTOR") return false;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { canReview: true, active: true, trainingOrgAsStaffUser: { select: { id: true } } } });
  return !!u && u.active && u.canReview && !u.trainingOrgAsStaffUser;
}

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { hashPassword } from "@/lib/auth/password";
import { notifyByEmail } from "@/lib/notifications/log";
import { trainingOrgMemberInviteEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

/** 48 hours, the same window as an AAICBI staff invitation. */
export const MEMBER_SETUP_LIFETIME_MS = 48 * 60 * 60 * 1000;

/**
 * The session's training organization, or a 403. Every route under
 * /api/org uses this first: the organization is resolved from the
 * signed-in session on the server, never from anything the request
 * says, so one organization can never read or change another's data.
 */
export async function requireTrainingOrgSession() {
  const session = await requireRole("ADMIN");
  const org = await findTrainingOrgByStaffUserId(session.userId);
  if (!org) {
    const err = new Error("This area is for training organizations.") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return { session, org };
}

/** Issues a fresh invitation token for a member and emails the link. */
export async function issueMemberInvite(member: { id: string; name: string; email: string }, organizationName: string) {
  const setupToken = randomBytes(24).toString("hex");
  await prisma.trainingOrganizationMember.update({
    where: { id: member.id },
    data: { setupToken, setupTokenExpiresAt: new Date(Date.now() + MEMBER_SETUP_LIFETIME_MS) },
  });
  const setupUrl = appUrl(`/org/set-password?token=${setupToken}`);
  const content = trainingOrgMemberInviteEmail(member.name, organizationName, setupUrl);
  await notifyByEmail({
    recipientType: "TRAINING_ORG",
    recipientId: member.id,
    to: member.email,
    // No url: the link carries a one-time token and must not sit in
    // an in-app notification past its expiry (same reasoning as the
    // AAICBI staff invitation).
    type: "STAFF_ACCOUNT_CREATED",
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  return setupUrl;
}

/** A random, unusable password hash for a member who has not set one. */
export async function unusablePasswordHash() {
  return hashPassword(randomBytes(32).toString("hex"));
}

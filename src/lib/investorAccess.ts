import { prisma } from "@/lib/prisma";

/**
 * Same local 404-shaped-error pattern as employerAccess.ts's own
 * notFound helper — not a shared export anywhere in this project, so
 * this is its own local copy.
 */
function notFound(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  return err;
}

/**
 * Pitch & Post, Phase 2 — the investor counterpart to
 * requireApprovedEmployer. A pending or rejected investor gets a
 * 404-shaped error, not a 403 explaining why, matching the same
 * deliberate "not found" style — rather than confirming to an
 * unapproved account that the browsing/disclosure/interest features
 * exist and are simply withheld from them specifically.
 */
export async function requireApprovedInvestor(investorId: string) {
  const investor = await prisma.investor.findUnique({ where: { id: investorId } });
  if (!investor || investor.approvalState !== "APPROVED" || !investor.active) {
    throw notFound("Not found.");
  }
  return investor;
}

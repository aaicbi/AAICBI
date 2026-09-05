import { prisma } from "@/lib/prisma";

/**
 * Same local 404-shaped-error pattern as courseOwnership.ts's own
 * `notFound` helper — not a shared export anywhere in this project
 * (confirmed directly before assuming otherwise), so this is its own
 * local copy, matching the exact same shape for consistency rather
 * than inventing a different error convention for this one file.
 */
function notFound(message: string) {
  const err = new Error(message) as Error & { status?: number };
  err.status = 404;
  return err;
}

/**
 * M33 — a real, single source of truth for "is this employer actually
 * approved," reused across every route that needs to enforce it
 * (discover, express interest, view own introductions), not
 * duplicated at each one — the same discipline this project applies
 * everywhere a rule needs to stay consistent (courseAccess.ts's own
 * comment makes this exact argument, and M18's own audit found real
 * routes that had drifted from each other before this pattern was
 * consistently applied).
 *
 * A pending or rejected employer gets a 404-shaped error, not a
 * clearer 403 explaining why — matching the deliberate "not found"
 * style already used for ownership checks elsewhere in this project,
 * rather than confirming to an unapproved account that the discovery
 * feature exists and is simply withheld from them specifically.
 */
export async function requireApprovedEmployer(employerId: string) {
  const employer = await prisma.employer.findUnique({ where: { id: employerId } });
  if (!employer || employer.approvalState !== "APPROVED") {
    throw notFound("Not found.");
  }
  return employer;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { expireStaleJobPostings } from "@/lib/jobPostingExpiry";

/**
 * GET /api/admin/job-postings — returns every posting, not just the
 * pending queue. Audit finding, closed here: M36's own scope requires
 * an expired posting to "stay visible to staff themselves as
 * expired," but nothing previously gave staff any way to see a
 * posting once it left PENDING_REVIEW at all — genuinely unfulfilled
 * until this fix, not just an edge case. Sorted in application code,
 * not a Prisma orderBy alone — a plain alphabetical sort on `status`
 * puts "APPROVED" before "PENDING_REVIEW", the opposite of what's
 * actually needed here (caught by checking this directly rather than
 * assuming the obvious-looking `orderBy` clause was correct). Pending
 * postings — the ones needing action — come first, AI-flagged ones
 * prioritized within that group exactly as M34 already established,
 * with everything already decided or expired listed after. The
 * frontend splits this into "Pending Review" / "Previously Decided"
 * sections, the same shape M31's employer review page already uses.
 * Sweeps stale postings first so a genuinely expired one is never
 * shown to staff as a stale "APPROVED."
 */
// src/app/api/admin/job-postings/route.ts
export const dynamic = "force-dynamic";
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    await expireStaleJobPostings();

    const postings = await prisma.jobPosting.findMany({
      orderBy: { createdAt: "desc" },
      include: { employer: { select: { companyName: true } } },
    });

    const pending = postings.filter((p: (typeof postings)[number]) => p.status === "PENDING_REVIEW");
    const decided = postings.filter((p: (typeof postings)[number]) => p.status !== "PENDING_REVIEW");
    pending.sort((a: (typeof postings)[number], b: (typeof postings)[number]) => Number(b.aiFlagged) - Number(a.aiFlagged));

    return NextResponse.json([...pending, ...decided]);
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { expireStaleJobPostings } from "@/lib/jobPostingExpiry";

/**
 * GET /api/trainee/job-postings — the job board itself, gated behind
 * the exact same `publiclyDiscoverable` toggle as employer discovery
 * browsing — M30's own core decision was one toggle gating both
 * halves at once, not two separate ones, and this is that decision
 * actually enforced on the job-board side, not just the discovery
 * side M33 already built. A non-discoverable trainee gets a clear,
 * specific message here, not a confusing empty list — they need to
 * know *why* nothing shows, not just that nothing does.
 *
 * Only genuinely approved AND unexpired postings — checked here
 * directly with a real closingDate comparison, not left to whatever
 * `status` happens to say. Also sweeps every stale posting globally
 * first (see jobPostingExpiry.ts's own comment) — this route's own
 * query already correctly hides an expired posting from trainees
 * regardless, but running the sweep here too means the *stored*
 * status stays honest for staff and employers even on days only
 * trainees are visiting the platform, not just when an employer
 * happens to check their own list.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: { publiclyDiscoverable: true },
    });
    if (!trainee.publiclyDiscoverable) {
      return NextResponse.json(
        { error: "Turn on discoverability in your settings to browse job postings." },
        { status: 403 }
      );
    }

    await expireStaleJobPostings();

    const postings = await prisma.jobPosting.findMany({
      // Audit finding, fixed here: `employer.approvalState: "APPROVED"`
      // added to this filter, not just `status: "APPROVED"` on the
      // posting itself. An employer's own approval is genuinely
      // reversible (see the employer-decide route's own comment —
      // "this was rejected by mistake, reconsider it" is a real,
      // supported scenario), which means the reverse is also real: an
      // employer approved when they posted could be reconsidered and
      // rejected afterward. Without this check, that employer's
      // already-approved posting would keep showing to trainees
      // indefinitely, even though staff no longer stands behind the
      // account that posted it — the posting's own status alone isn't
      // enough to guarantee that at read time, only at the moment it
      // was originally approved.
      where: { status: "APPROVED", closingDate: { gt: new Date() }, employer: { approvalState: "APPROVED" } },
      orderBy: { createdAt: "desc" },
      include: { employer: { select: { companyName: true } } },
    });
    return NextResponse.json(postings);
  });
}

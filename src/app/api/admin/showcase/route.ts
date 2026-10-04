import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/showcase — every project a trainee has opted into
 * listing, not just the pending queue. Same shape as
 * GET /api/admin/job-postings: sorted in application code (pending
 * first, decided after), not a Prisma `orderBy` alone — a plain
 * alphabetical sort on `showcaseStatus` wouldn't put PENDING_REVIEW
 * first. The admin page splits this into "Pending Review" /
 * "Previously Decided" sections, the same shape the job-postings page
 * already uses.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    // Training Organizations, Phase 2 — Project has no FK to Course or
    // any creator, so it's structurally incapable of per-organization
    // scoping. Same defense-in-depth 404 as the trainees route's own
    // comment explains.
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const projects = await prisma.project.findMany({
      where: { listedInShowcase: true },
      orderBy: { id: "desc" },
      include: { trainee: { select: { name: true } }, media: { orderBy: { order: "asc" } } },
    });

    const pending = projects.filter((p) => p.showcaseStatus === "PENDING_REVIEW");
    const decided = projects.filter((p) => p.showcaseStatus !== "PENDING_REVIEW");

    return NextResponse.json([...pending, ...decided]);
  });
}

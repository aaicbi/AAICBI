import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

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
    await requireRole("SUPER_ADMIN", "ADMIN");

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

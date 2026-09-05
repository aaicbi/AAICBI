import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireApprovedEmployer } from "@/lib/employerAccess";
import { screenJobPosting } from "@/lib/ai/screenJobPosting";
import { expireStaleJobPostings } from "@/lib/jobPostingExpiry";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { newJobPostingPendingEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const CreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(20),
  closingDate: z.string().datetime(),
});

/**
 * POST /api/employer/job-postings — the actual "post a vacancy" flow.
 * A required closing date, not optional — nothing in this roadmap
 * relies on staff remembering to take an old listing down manually
 * (see M36), and rejecting a date that's already in the past here is
 * what makes that guarantee meaningful rather than just assumed.
 *
 * Every posting is screened before it's ever stored with anything
 * other than PENDING_REVIEW — but the AI's own verdict never changes
 * that status. `aiFlagged`/`aiFlagReason` are stored purely as
 * information for the staff member who has to make the real decision
 * (see the admin decide route) — this route itself makes no approval
 * decision at all.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const employer = await requireApprovedEmployer(session.userId);

    const body = await req.json();
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const closingDate = new Date(parsed.data.closingDate);
    if (closingDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: "Closing date must be in the future." }, { status: 400 });
    }

    const screening = await screenJobPosting(parsed.data.title, parsed.data.description);

    const posting = await prisma.jobPosting.create({
      data: {
        employerId: session.userId,
        title: parsed.data.title,
        description: parsed.data.description,
        closingDate,
        aiFlagged: screening.flagged,
        aiFlagReason: screening.reason,
      },
    });

    // Stage 6 audit — staff previously had zero proactive notification
    // that a new posting was even waiting for review.
    const content = newJobPostingPendingEmail({
      companyName: employer.companyName,
      postingTitle: posting.title,
      aiFlagged: screening.flagged,
      reviewUrl: appUrl("/admin/job-postings"),
    });
    await notifyAllAdminStaff("NEW_JOB_POSTING_PENDING", posting.id, content, "/admin/job-postings");

    return NextResponse.json(posting, { status: 201 });
  });
}

/**
 * GET /api/employer/job-postings — an employer's own postings, across
 * every status, so they can see where each one actually stands. Sweeps
 * every stale posting globally first (see jobPostingExpiry.ts's own
 * comment for why this isn't scoped to just this employer's own
 * rows) — the natural place to run it whenever someone is genuinely
 * about to look at status directly.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    await requireApprovedEmployer(session.userId);

    await expireStaleJobPostings();

    const postings = await prisma.jobPosting.findMany({
      where: { employerId: session.userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(postings);
  });
}

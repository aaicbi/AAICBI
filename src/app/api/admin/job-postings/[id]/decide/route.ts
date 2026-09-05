import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { jobPostingApprovedEmail, jobPostingRejectedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const DecideSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/**
 * POST /api/admin/job-postings/[id]/decide — the actual staff
 * approval M34's own scope requires before anyone sees a posting,
 * regardless of what the AI screening returned.
 *
 * A real, deliberate difference from M31's employer-decide route,
 * which allows re-deciding an already-decided account at any time —
 * this route doesn't, and the reason is specific to postings, not a
 * general policy against reconsidering staff decisions: a posting
 * carries its own closing date, set once at creation. Reconsidering a
 * rejected posting long after the fact risks approving one whose
 * closing date has already quietly passed, publishing something
 * immediately stale rather than a real, current vacancy. The simpler,
 * safer path is asking the employer to resubmit with a fresh closing
 * date, not reviving an old submission's.
 *
 * Audit finding, closed here: nothing previously told the employer
 * their posting had been decided on — they'd have had no way to know
 * it went live (or didn't) except checking back manually. Same
 * "essential, not optional" treatment as the employer-decide route's
 * own fix, wrapped so a notification failure can never block the
 * decision that already succeeded.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const posting = await prisma.jobPosting.findUnique({
      where: { id: params.id },
      include: { employer: { select: { id: true, email: true, contactName: true } } },
    });
    if (!posting || posting.status !== "PENDING_REVIEW") {
      return NextResponse.json({ error: "Posting not found or already decided." }, { status: 404 });
    }

    const updated = await prisma.jobPosting.update({
      where: { id: params.id },
      data: {
        status: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    });

    try {
      const postingsUrl = appUrl("/employer/job-postings");
      const content =
        parsed.data.action === "APPROVE"
          ? jobPostingApprovedEmail({ contactName: posting.employer.contactName, postingTitle: posting.title, postingsUrl })
          : jobPostingRejectedEmail({ contactName: posting.employer.contactName, postingTitle: posting.title, postingsUrl });
      await notifyByEmail({
        recipientType: "EMPLOYER",
        recipientId: posting.employer.id,
        to: posting.employer.email,
        type: parsed.data.action === "APPROVE" ? "JOB_POSTING_APPROVED" : "JOB_POSTING_REJECTED",
        relatedId: posting.id,
        // Part 11 — click lands the employer on their job postings
        // page, where the posting this decision concerns is listed.
        url: "/employer/job-postings",
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (e) {
      console.error(`Job posting decision notification failed for posting ${posting.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}

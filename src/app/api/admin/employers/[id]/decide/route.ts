import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { employerApprovedEmail, employerRejectedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const DecideSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/**
 * POST /api/admin/employers/[id]/decide — the actual mechanism behind
 * "no open self-signup," the real deliverable M31's own scope names.
 * SUPER_ADMIN/ADMIN only, same platform-wide-decision reasoning as the
 * list route above.
 *
 * Deliberately allows changing an already-decided employer, not
 * blocked as a one-time-only action — a legitimate "this was rejected
 * by mistake, reconsider it" is a real scenario worth supporting, not
 * something to lock out. `approvedById`/`approvedAt` always reflect
 * whoever most recently made the actual decision, an honest current
 * record rather than a stale first-decision-only one.
 *
 * Audit finding, closed here: nothing previously told the employer
 * their account had been decided on at all — they'd have had no way
 * to know except logging back in and checking manually. Treated as
 * essential, not optional, matching how account-critical trainee
 * emails already work — an employer has no notification-preference
 * toggle to gate this behind, and an account-status decision isn't
 * the kind of thing that should be silently missable. Wrapped so a
 * notification failure can never block the decision that already
 * succeeded, the same discipline used throughout this project.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const employer = await prisma.employer.findUnique({ where: { id: params.id } });
    if (!employer) {
      return NextResponse.json({ error: "Employer not found." }, { status: 404 });
    }

    const updated = await prisma.employer.update({
      where: { id: params.id },
      data: {
        approvalState: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        approvedById: session.userId,
        approvedAt: new Date(),
      },
    });

    try {
      const content =
        parsed.data.action === "APPROVE"
          ? employerApprovedEmail({ contactName: employer.contactName, loginUrl: appUrl("/employer/login") })
          : employerRejectedEmail({ contactName: employer.contactName, loginUrl: appUrl("/employer/login") });
      await notifyByEmail({
        recipientType: "EMPLOYER",
        recipientId: employer.id,
        to: employer.email,
        type: parsed.data.action === "APPROVE" ? "EMPLOYER_APPROVED" : "EMPLOYER_REJECTED",
        // Part 11 — click lands the employer on their status page,
        // where the approval decision they're being notified about is
        // actually reflected.
        url: "/employer/status",
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (e) {
      console.error(`Employer decision notification failed for employer ${employer.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}

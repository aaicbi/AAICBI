import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { notifyByEmail } from "@/lib/notifications/log";
import { trainingOrgApprovedEmail, trainingOrgRejectedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const DecideSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/**
 * POST /api/admin/training-organizations/[id]/decide — same
 * allow-re-decide shape as .../employers/[id]/decide (see that
 * route's own comment). The one real addition: APPROVE also
 * provisions the org's shadow staff `User` (role ADMIN, a random
 * never-shared password — this account is never meant to log in
 * directly, it only exists so Course.createdById has somewhere to
 * point, see TrainingOrganization.staffUserId's own schema comment)
 * the FIRST time an org is approved. A later re-approve (after a
 * REJECT) reuses the existing shadow account rather than creating a
 * second one, orphaning the first.
 *
 * Security audit finding — SUPER_ADMIN only, NOT "ADMIN": a training
 * organization's own login issues a real ADMIN session on exactly the
 * shadow account this route itself provisions, so allowing plain
 * "ADMIN" here let any org approve/reject ANY organization, including
 * reinstating its own after a REJECT, or deciding a competitor's. The
 * sibling billing PATCH route (../[id]/route.ts) already required
 * SUPER_ADMIN only for this exact reason — this route never matched it.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id } });
    if (!org) {
      return NextResponse.json({ error: "Training organization not found." }, { status: 404 });
    }

    let staffUserId = org.staffUserId;
    if (parsed.data.action === "APPROVE" && !staffUserId) {
      const randomPasswordHash = await hashPassword(randomBytes(24).toString("hex"));
      const staffUser = await prisma.user.create({
        data: {
          name: org.name,
          email: `training-org-${org.id}@internal.aaicbi.invalid`,
          passwordHash: randomPasswordHash,
          role: "ADMIN",
        },
      });
      staffUserId = staffUser.id;
    }

    const updated = await prisma.trainingOrganization.update({
      where: { id: params.id },
      data: {
        approvalState: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        approvedById: session.userId,
        approvedAt: new Date(),
        staffUserId,
      },
    });

    try {
      const content =
        parsed.data.action === "APPROVE"
          ? trainingOrgApprovedEmail({ contactName: org.contactName, loginUrl: appUrl("/org/login") })
          : trainingOrgRejectedEmail({ contactName: org.contactName, loginUrl: appUrl("/org/login") });
      await notifyByEmail({
        recipientType: "TRAINING_ORG",
        recipientId: org.id,
        to: org.email,
        type: parsed.data.action === "APPROVE" ? "TRAINING_ORG_APPROVED" : "TRAINING_ORG_REJECTED",
        url: "/org/login",
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (e) {
      console.error(`Training organization decision notification failed for org ${org.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { notifyByEmail } from "@/lib/notifications/log";
import { investorApprovedEmail, investorRejectedEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const DecideSchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/**
 * POST /api/admin/investors/[id]/decide — mirrors
 * POST /api/admin/employers/[id]/decide exactly: SUPER_ADMIN/ADMIN
 * only, re-decision allowed (approvedById/approvedAt always reflect
 * whoever most recently decided), notification wrapped so a failure
 * never blocks the already-committed decision.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const investor = await prisma.investor.findUnique({ where: { id: params.id } });
    if (!investor) {
      return NextResponse.json({ error: "Investor not found." }, { status: 404 });
    }

    // Bug fix, caught in testing: a bare update() returns every column
    // by default, including passwordHash — never something a response
    // body should carry, even hashed. select only what the admin UI
    // actually needs.
    const updated = await prisma.investor.update({
      where: { id: params.id },
      data: {
        approvalState: parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED",
        approvedById: session.userId,
        approvedAt: new Date(),
      },
      select: { id: true, name: true, email: true, organization: true, approvalState: true, approvedAt: true },
    });

    try {
      const content =
        parsed.data.action === "APPROVE"
          ? investorApprovedEmail({ name: investor.name, loginUrl: appUrl("/investor/login") })
          : investorRejectedEmail({ name: investor.name, loginUrl: appUrl("/investor/login") });
      await notifyByEmail({
        recipientType: "INVESTOR",
        recipientId: investor.id,
        to: investor.email,
        type: parsed.data.action === "APPROVE" ? "INVESTOR_APPROVED" : "INVESTOR_REJECTED",
        url: "/investor/status",
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (e) {
      console.error(`Investor decision notification failed for investor ${investor.id}:`, e);
    }

    return NextResponse.json(updated);
  });
}

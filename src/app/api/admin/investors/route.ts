import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { notifyByEmail } from "@/lib/notifications/log";
import { investorWelcomeEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const CreateInvestorSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  organization: z.string().trim().min(1),
  phone: z.string().trim().optional().or(z.literal("")),
  linkedinUrl: z.string().trim().optional().or(z.literal("")),
});

// 48 hours — same as the staff setup-link lifetime: a real invitation
// someone may not open right away, not a time-sensitive reset window.
const SETUP_TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000;

/**
 * GET/POST /api/admin/investors — Pitch & Post, Phase 1's investor
 * pool. Mirrors POST /api/admin/staff's exact pattern: a genuinely
 * random, never-transmitted initial password, a real setup-token
 * reused from the password-reset mechanism, and a welcome email with
 * the setup link. The admin creating the account IS the vetting step
 * for Phase 1 — no separate approval-state machine like Employer's,
 * since there's no self-registration path to gate here yet.
 */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const investors = await prisma.investor.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, organization: true, active: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json(investors);
  });
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");

    const body = await req.json();
    const parsed = CreateInvestorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.investor.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An investor account with that email already exists." }, { status: 409 });
    }

    const unusedPasswordHash = await hashPassword(randomBytes(32).toString("hex"));
    const setupToken = randomBytes(24).toString("hex");

    const investor = await prisma.investor.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        organization: parsed.data.organization,
        phone: parsed.data.phone || null,
        linkedinUrl: parsed.data.linkedinUrl || null,
        passwordHash: unusedPasswordHash,
        resetToken: setupToken,
        resetTokenExpiresAt: new Date(Date.now() + SETUP_TOKEN_LIFETIME_MS),
        createdById: session.userId,
      },
    });

    const setupUrl = appUrl(`/investor/reset-password?token=${setupToken}`);
    const content = investorWelcomeEmail(investor.name, setupUrl);
    await notifyByEmail({
      recipientType: "INVESTOR",
      recipientId: investor.id,
      to: investor.email,
      type: "INVESTOR_ACCOUNT_CREATED",
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    return NextResponse.json(
      { id: investor.id, name: investor.name, email: investor.email, organization: investor.organization },
      { status: 201 }
    );
  });
}

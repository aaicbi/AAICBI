import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { safeUrl } from "@/lib/materialUrl";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { newInvestorPendingEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  organization: z.string().min(1),
  phone: z.string().optional(),
  linkedinUrl: safeUrl.optional().or(z.literal("")),
});

/**
 * POST /api/auth/investor-register — Pitch & Post, Phase 2's open
 * self-registration, mirroring POST /api/auth/employer-register
 * exactly: anyone can submit this, but the account lands PENDING (the
 * column's own default — never set explicitly here), not immediate
 * access. A session is created immediately, same as Employer, so the
 * investor can log back in and see their own status even before a
 * decision — every real action (browsing pitches, requesting
 * disclosure, expressing interest) stays gated behind
 * `approvalState === "APPROVED"` at requireApprovedInvestor, not here.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limitKey = `investor-register:${clientIp(req)}`;
    const limited = await rateLimit(limitKey, 10, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a while and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.investor.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const investor = await prisma.investor.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        organization: parsed.data.organization,
        phone: parsed.data.phone || null,
        linkedinUrl: parsed.data.linkedinUrl || null,
      },
    });

    await createSession({ userId: investor.id, email: investor.email, role: "INVESTOR" });

    const content = newInvestorPendingEmail({ name: investor.name, organization: investor.organization, reviewUrl: appUrl("/admin/investors") });
    await notifyAllAdminStaff("NEW_INVESTOR_PENDING", investor.id, content, "/admin/investors");

    return NextResponse.json({ id: investor.id, name: investor.name, approvalState: investor.approvalState });
  });
}

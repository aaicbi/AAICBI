import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/investor-login — Pitch & Post's fourth account type.
 * Same session infrastructure as employer/trainee/staff login, same
 * generic "invalid email or password" (never reveals which one was
 * wrong). No gating on `approvalState` here — same as Employer login,
 * a PENDING or REJECTED investor can still log in to see their own
 * status at /investor/status; every real action stays gated behind
 * requireApprovedInvestor at the routes that actually do those things.
 * `active` stays a genuinely separate kill-switch (e.g. suspending an
 * already-approved investor) — an inactive account can't log in at
 * all, regardless of approvalState.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const limitKey = `investor-login:${clientIp(req)}:${parsed.data.email}`;
  const limited = await rateLimit(limitKey, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const investor = await prisma.investor.findUnique({ where: { email: parsed.data.email } });
  if (!investor || !investor.active || !(await verifyPassword(parsed.data.password, investor.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSession({ userId: investor.id, email: investor.email, role: "INVESTOR" });
  await prisma.investor.update({ where: { id: investor.id }, data: { lastLoginAt: new Date() } });

  return NextResponse.json({
    id: investor.id,
    name: investor.name,
    organization: investor.organization,
    approvalState: investor.approvalState,
  });
}

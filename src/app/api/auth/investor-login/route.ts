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
 * POST /api/auth/investor-login — Pitch & Post, Phase 1's fourth
 * account type. Same session infrastructure as employer/trainee/staff
 * login, same generic "invalid email or password" (never reveals which
 * one was wrong). Unlike employer login, an inactive investor account
 * (`active: false`) is rejected outright here rather than allowed
 * through to see a status screen — there's no PENDING/REJECTED state
 * to show for Phase 1's admin-created accounts, so "not active" simply
 * means the account shouldn't be usable at all right now.
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

  return NextResponse.json({ id: investor.id, name: investor.name, organization: investor.organization });
}

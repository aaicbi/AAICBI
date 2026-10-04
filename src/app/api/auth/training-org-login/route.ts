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
 * POST /api/auth/training-org-login — Training Organizations, Phase 1.
 * Same password-verify shape as employer-login, with one deliberate,
 * explicit difference: Employer/Investor logins let a PENDING/REJECTED
 * account log in (to a status page) — this type refuses to issue a
 * session at all until approvalState is APPROVED, settled this way in
 * discussion rather than copied from the other two. A wrong password
 * and a not-yet-approved account return the exact same generic error
 * shape (just a different message), so this never confirms an email
 * exists before password verification.
 *
 * Phase 2 — the session issued here is now the org's shadow staff
 * `User` as a real ADMIN session (see TrainingOrganization.staffUserId's
 * own schema comment), not a standalone TRAINING_ORG session: this is
 * what lets the org reuse the real admin course-builder directly
 * instead of Phase 1's bespoke /org/dashboard. An APPROVED org always
 * has a staffUserId (the decide route's APPROVE branch provisions it
 * the first time), so the missing-staffUserId branch below is only a
 * defensive guard against a data inconsistency, never an expected path.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const limitKey = `training-org-login:${clientIp(req)}:${parsed.data.email}`;
  const limited = await rateLimit(limitKey, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const org = await prisma.trainingOrganization.findUnique({ where: { email: parsed.data.email } });
  if (!org || !(await verifyPassword(parsed.data.password, org.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (org.approvalState !== "APPROVED") {
    return NextResponse.json(
      { error: "Your account is still pending approval. We'll email you once it's reviewed." },
      { status: 401 }
    );
  }

  if (!org.staffUserId) {
    console.error(`Training organization ${org.id} is APPROVED but has no staffUserId — cannot issue a session.`);
    return NextResponse.json({ error: "Your account isn't fully set up yet. Please contact AAICBI." }, { status: 500 });
  }

  await createSession({ userId: org.staffUserId, email: org.email, role: "ADMIN" });
  await prisma.trainingOrganization.update({
    where: { id: org.id },
    data: { previousLoginAt: org.lastLoginAt, lastLoginAt: new Date() },
  });
  return NextResponse.json({ id: org.id, name: org.name, approvalState: org.approvalState });
}

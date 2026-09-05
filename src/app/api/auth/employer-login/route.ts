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
 * POST /api/auth/employer-login — the third account type's login,
 * reusing the exact same session infrastructure as trainee/staff
 * login rather than a parallel auth system, matching M31's own
 * explicit scope. Deliberately does NOT block login for a PENDING or
 * REJECTED employer — they can still see their own account status
 * this way, matching the reasoning already stated in the registration
 * route. What actually stays gated is the real functionality
 * (browsing trainees, posting jobs), enforced at those specific
 * routes in M33/M34, not here.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Same rate-limit shape as trainee/staff login — see the comment
  // there for why IP+email is the key.
  const limitKey = `employer-login:${clientIp(req)}:${parsed.data.email}`;
  const limited = await rateLimit(limitKey, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const employer = await prisma.employer.findUnique({ where: { email: parsed.data.email } });
  // Same generic error whether the email doesn't exist or the password
  // is wrong — don't leak which one it was, matching the trainee/staff
  // login routes' own pattern.
  if (!employer || !(await verifyPassword(parsed.data.password, employer.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSession({ userId: employer.id, email: employer.email, role: "EMPLOYER" });
  return NextResponse.json({
    id: employer.id,
    companyName: employer.companyName,
    approvalState: employer.approvalState,
  });
}

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  // Same rate-limit shape as the staff login route — see the comment
  // there for why IP+email is the key.
  const limitKey = `trainee-login:${clientIp(req)}:${parsed.data.email}`;
  const limited = await rateLimit(limitKey, 5, 15 * 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  const trainee = await prisma.trainee.findUnique({ where: { email: parsed.data.email } });
  // Same generic error whether the email doesn't exist or the password is
  // wrong — don't leak which one it was. Matches the staff login route's
  // pattern in src/app/api/auth/login/route.ts.
  if (!trainee || !(await verifyPassword(parsed.data.password, trainee.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await createSession({ userId: trainee.id, email: trainee.email, role: "TRAINEE" });
  // M38 — the actual fix for the gap the audit caught: this is the one
  // and only place a trainee's login is genuinely known to have
  // succeeded, so it's the only correct place to set this.
  //
  // Genuinely awaited, not fire-and-forget — a second self-audit
  // caught that an un-awaited write here was a real, new risk, not a
  // harmless optimization: this project's recommended deployment
  // target is Vercel (see DEPLOYMENT.md), where a serverless
  // function's execution can be torn down shortly after the response
  // is sent, meaning an un-awaited promise can genuinely never finish
  // running. Nothing else in this codebase uses fire-and-forget for a
  // write — this would have been a new, unproven pattern for a single,
  // trivial primary-key update, not worth the risk it introduced.
  await prisma.trainee.update({ where: { id: trainee.id }, data: { lastLoginAt: new Date() } });
  return NextResponse.json({ id: trainee.id, name: trainee.name, email: trainee.email });
}

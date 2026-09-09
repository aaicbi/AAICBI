import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { completeTraineeLogin } from "@/lib/auth/completeTraineeLogin";
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
  // Same generic error whether the email doesn't exist, the password is
  // wrong, or (Google sign-in) the account has no password at all —
  // don't leak which one it was. `trainee.passwordHash` is null for a
  // Google-only account (see the schema's own comment on that field);
  // checked explicitly here rather than passing null into
  // verifyPassword, which only ever expects a real hash to compare
  // against.
  if (!trainee || !trainee.passwordHash || !(await verifyPassword(parsed.data.password, trainee.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  // M38 — the actual fix for the gap the audit caught: this is the one
  // and only place a trainee's login is genuinely known to have
  // succeeded, so it's the only correct place to set login-tracking
  // fields — see completeTraineeLogin's own comment for why this is
  // now shared with the Google sign-in callback rather than duplicated.
  await completeTraineeLogin(trainee);
  return NextResponse.json({ id: trainee.id, name: trainee.name, email: trainee.email });
}

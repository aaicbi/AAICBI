import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { createTraineeAccount, sendTraineeWelcome } from "@/lib/auth/traineeSignup";
import { StartupInputSchema } from "@/lib/startups/startupCore";
import { createStartup } from "@/lib/startups/startups";

const Schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  phone: z.string().trim().max(40).optional(),
  privacyConsent: z.literal(true, { errorMap: () => ({ message: "You must agree to the Privacy Policy to create an account." }) }),
  startup: StartupInputSchema.pick({ name: true, tagline: true, industry: true, stage: true, location: true, website: true, description: true }),
});

/**
 * POST /api/auth/startup-register: the founder sign-up. In one request it creates a member account (the same kind of account
 * a trainee has, marked as a founder's) and the founder's startup, as a draft with the person as its only founder. The startup
 * is not public until its profile is complete, submitted and approved by the AAICBI team. Nothing the browser sends can choose
 * the account's kind or role (unknown fields are dropped); the server sets both. Rate-limited like the trainee sign-up.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limited = await rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json({ error: "Too many registration attempts from this connection. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } });
    }
    const parsed = Schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check your details." }, { status: 400 });
    const d = parsed.data;

    if (await prisma.trainee.findUnique({ where: { email: d.email }, select: { id: true } })) {
      return NextResponse.json({ error: "An account with this email already exists. Log in instead, then add your startup from My Startups." }, { status: 409 });
    }
    let created;
    try {
      created = await createTraineeAccount({ name: d.name, email: d.email, phone: d.phone, password: d.password, kind: "FOUNDER" });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      throw e;
    }
    let startupId: string | null = null;
    let startupProblem = false;
    try {
      startupId = (await createStartup(created.trainee.id, { ...d.startup, problem: null, solution: null, traction: null, fundingNeed: null, seeking: [] })).id;
    } catch (e) {
      // The account is the part that must not be lost; the startup can be added after signing in.
      startupProblem = true;
      console.error("Founder sign-up: the account was created but the startup was not:", e instanceof Error ? e.message : e);
    }
    await sendTraineeWelcome(created.trainee, created.verifyToken);
    return NextResponse.json({ startupId, startupProblem }, { status: 201 });
  });
}

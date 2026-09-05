import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notifyByEmail } from "@/lib/notifications/log";
import { welcomeEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

const RegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().optional(),
  // Consent is a required field, not an optional nicety — the API
  // rejects registration outright if it isn't explicitly true, same as
  // any other required field. See the LMS privacy policy (docs/) for
  // what a trainee is actually agreeing to.
  privacyConsent: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Privacy Policy to create an account." }),
  }),
  // M24 — optional course selection at registration. Deliberately
  // reuses the exact enrollment shape M19's free self-enroll route
  // already established (source: FREE, unlockedAt set immediately),
  // not a new, parallel mechanism — see this route's own enrollment
  // step below for why a paid course is never reachable through this
  // field at all, not just rejected after the fact.
  courseId: z.string().optional(),
});

const VERIFY_TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000; // 48 hours — see M9 audit finding #6

/**
 * Trainee self-registration — the M9 change that didn't exist in the CBT
 * scaffold at all (students there were never given accounts). Creates an
 * unverified Trainee and a verify token, and sends the verification
 * email (M14 — see notifyByEmail below; this was a documented gap from
 * M9 through M13, tracked as a TODO on this exact line).
 *
 * M9 audit fixes applied here:
 * - #1: rate-limited (10 registrations/hour per IP) — registration is
 *   the one auth route reachable with no existing account at all, so
 *   it's the natural target for mass account creation without a limit.
 * - #2: now wrapped in withApiErrors like every other route (it
 *   previously wasn't, the only inconsistent one), and the
 *   findUnique-then-create duplicate-email check is backed by a caught
 *   Prisma P2002 error — if two requests for the same email race each
 *   other, the loser now gets the same clean 409 instead of an
 *   unhandled 500.
 *
 * Also requires explicit privacy-policy consent (privacyConsent: true)
 * and records when it was given (Trainee.privacyConsentAt) — added
 * alongside the LMS-specific privacy policy in docs/, not a separate
 * afterthought.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const limitKey = `register:${clientIp(req)}`;
    const limited = await rateLimit(limitKey, 10, 60 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts from this connection. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid registration details." },
        { status: 400 }
      );
    }

    const existing = await prisma.trainee.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const verifyToken = randomBytes(24).toString("hex");
    const verifyTokenExpiresAt = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS);

    let trainee;
    try {
      trainee = await prisma.trainee.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone,
          passwordHash,
          verifyToken,
          verifyTokenExpiresAt,
          // Recorded, not just checked — see the schema comment on
          // Trainee.privacyConsentAt for why the timestamp itself is
          // the actual evidence, not the fact that a checkbox existed
          // in the UI at some point.
          privacyConsentAt: new Date(),
        },
      });
    } catch (e) {
      // The findUnique check above narrows this to a genuine race: two
      // requests for the same email close enough together that both
      // passed the check before either commit. Report it the same way
      // as the non-race case rather than letting a raw Prisma error
      // become an unhandled 500.
      //
      // Duck-typed check (`.code === "P2002"`) rather than
      // `instanceof Prisma.PrismaClientKnownRequestError`: in this
      // sandbox, prisma generate can't run (see README), so the
      // generated client's types — including that error class — aren't
      // available to import correctly. This check is exactly what that
      // instanceof check would do at runtime regardless; it just doesn't
      // depend on a type that happens to be broken in this environment
      // specifically.
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      }
      throw e;
    }

    // M24 — optional course enrollment at registration, reusing the
    // exact same enrollment-creation shape as M19's free self-enroll
    // route (source: FREE, unlockedAt set immediately). Deliberately
    // best-effort: a trainee's ACCOUNT is the thing this route exists
    // to create, and a problem with the optional course selection
    // (an invalid id, a course that got unpublished between page load
    // and submit, a course that turned out not to be free) should
    // never fail the registration itself — the trainee still gets a
    // real account either way, just without that one course attached,
    // and can enroll normally from the course page afterward.
    if (parsed.data.courseId) {
      try {
        const course = await prisma.course.findUnique({
          where: { id: parsed.data.courseId },
          select: { id: true, published: true, isFree: true },
        });
        if (course?.published && course.isFree) {
          await prisma.courseEnrollment.create({
            data: { traineeId: trainee.id, courseId: course.id, source: "FREE", unlockedAt: new Date() },
          });
        }
      } catch (e) {
        console.error(`Course enrollment at registration failed for trainee ${trainee.id}, course ${parsed.data.courseId}:`, e);
      }
    }

    // M14: welcome/verify email. Fire-and-forget-with-logging via
    // notifyByEmail — never lets a failed/slow send affect the
    // registration response, matching the graceful-degradation rule
    // used everywhere else external calls happen in this project.
    // Awaited (not truly fire-and-forget) because this route runs in a
    // serverless function that may terminate the moment a response is
    // sent — same reasoning M13 documented for its own AI call.
    const verifyUrl = appUrl(`/trainee/verify?token=${verifyToken}`);
    const email = welcomeEmail(trainee.name, verifyUrl);
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: trainee.id,
      to: trainee.email,
      type: "WELCOME",
      subject: email.subject,
      html: email.html,
      text: email.text,
      // M43 — wired for consistency with the roadmap's own named list
      // of events, though genuinely inert in practice for this
      // specific one: a trainee can't have opted into WhatsApp before
      // their account exists, so isEligibleForWhatsApp always
      // correctly returns false here. Left in rather than special-
      // cased out, since the check itself is what makes that safe —
      // no harm in the field being present, and it stays consistent
      // with every other notifyByEmail call this milestone touches.
      whatsapp: { templateName: "welcome_verify", variables: { name: trainee.name, verify_url: verifyUrl } },
    });

    return NextResponse.json({ id: trainee.id, name: trainee.name, email: trainee.email });
  });
}

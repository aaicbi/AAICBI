import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { ensureProfileQuietly } from "@/lib/profiles/profiles";
import { notifyByEmail } from "@/lib/notifications/log";
import { welcomeEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import { getConsentDecision, getVisitorId } from "@/lib/analytics/visitorCookies";

const VERIFY_TOKEN_LIFETIME_MS = 48 * 60 * 60 * 1000; // 48 hours

/**
 * Creates an unverified member (Trainee) account with a verification token and its profile. Shared by the trainee sign-up and the
 * founder sign-up so the two cannot drift apart. The account kind is chosen here by the server; no request can set it.
 * A duplicate email surfaces as the database's unique-constraint error (code P2002) for the caller to turn into a 409.
 */
export async function createTraineeAccount(input: { name: string; email: string; phone?: string | null; password: string; kind: "TRAINEE" | "FOUNDER" }) {
  const passwordHash = await hashPassword(input.password);
  const verifyToken = randomBytes(24).toString("hex");
  // Only recorded when this same browser had already accepted cookie tracking.
  const registrationVisitorId = getConsentDecision() === "accepted" ? getVisitorId() : null;
  const trainee = await prisma.trainee.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone ?? undefined,
      passwordHash,
      signupKind: input.kind,
      verifyToken,
      verifyTokenExpiresAt: new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS),
      // The timestamp is the evidence of consent, not the existence of a checkbox.
      privacyConsentAt: new Date(),
      registrationVisitorId: registrationVisitorId ?? undefined,
    },
  });
  await ensureProfileQuietly("PERSON", trainee.id);
  return { trainee, verifyToken };
}

/** The welcome email with the verification link. Awaited by callers because serverless functions may stop once the response is sent. */
export async function sendTraineeWelcome(trainee: { id: string; name: string; email: string }, verifyToken: string): Promise<void> {
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
    whatsapp: { templateName: "welcome_verify", variables: { name: trainee.name, verify_url: verifyUrl } },
  });
}

import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth/session";
import { trackEvent } from "@/lib/analytics/track";

/**
 * The exact two steps a trainee login is only ever genuinely known to
 * have succeeded and needs to record — session issuance (session.ts)
 * and login-tracking (M38/personalized-landing-page's
 * lastLoginAt/previousLoginAt pair, see Trainee's own schema comment).
 * Extracted here once Google sign-in needed the identical sequence a
 * second time (src/app/api/auth/google/callback/route.ts) — password
 * login (trainee-login/route.ts) uses this too now, so there's exactly
 * one place this logic can drift, not two copies quietly diverging.
 * Same reasoning is why Analytics System Phase 1's LOGIN event is
 * recorded here rather than in each individual login route — one shared
 * point, not two copies to keep in sync.
 */
export async function completeTraineeLogin(trainee: { id: string; email: string; lastLoginAt: Date | null }): Promise<void> {
  await createSession({ userId: trainee.id, email: trainee.email, role: "TRAINEE" });
  await prisma.trainee.update({
    where: { id: trainee.id },
    data: { previousLoginAt: trainee.lastLoginAt, lastLoginAt: new Date() },
  });
  await trackEvent({ recipientType: "TRAINEE", userId: trainee.id, type: "LOGIN" });
}

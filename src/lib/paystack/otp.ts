import { randomInt } from "crypto";

/**
 * M28 — a short, typed-in numeric code, deliberately distinct from
 * Trainee.verifyToken's long, link-only pattern (see the schema
 * comment on CourseEnrollment.otpCode for why both exist). 6 digits —
 * the standard length for this class of code (bank SMS codes, 2FA
 * apps), long enough that guessing isn't feasible within a real rate
 * limit, short enough to type by hand without a copy-paste link.
 *
 * `crypto.randomInt`, not `Math.random()` — this is a real security
 * code gating paid access, not a cosmetic ID. Worth being precise
 * about the comparison: this project's other secrets (verifyToken,
 * certificate codes) use `crypto.randomBytes` for hex strings —
 * `randomInt` is a different function, but the same cryptographically
 * secure source, and the more precisely-suited tool here specifically
 * because this needs a bounded random *integer*, not a byte string.
 */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export const OTP_EXPIRY_MINUTES = 15;

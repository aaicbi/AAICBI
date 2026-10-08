/**
 * The rules for what the public may see, in one place and with no
 * database or framework imports so they can be tested on their own.
 */

/**
 * An open job: APPROVED by staff, not past its closing date, and posted by
 * an employer who is still APPROVED. Same rule as the trainee job board.
 */
export function openJobWhere(now: Date = new Date()) {
  return {
    status: "APPROVED" as const,
    closingDate: { gt: now },
    employer: { approvalState: "APPROVED" as const },
  };
}

/**
 * A trainee the public may see: profile visibility set to PUBLIC by the
 * trainee, a username to link to, and a verified email. Visibility is the
 * trainee's own choice and defaults to private.
 */
export function publicTraineeWhere() {
  return {
    profileVisibility: "PUBLIC" as const,
    username: { not: null },
    emailVerified: true,
  };
}

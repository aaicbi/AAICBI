/**
 * Who may start a direct conversation with whom, as one pure table so the
 * rules can be read and tested in one place. The database facts they need
 * (is there an accepted introduction, does a cohort match) are looked up by
 * the caller and handed in.
 *
 * Existing rules, unchanged: trainees reach cohort-mates, the staff who teach
 * them and every Super Admin; staff and organizations reach the trainees in
 * their own cohorts; a Super Admin reaches everyone. New: employers.
 *
 * An employer and a trainee may talk only when the trainee has agreed to
 * engage: an introduction the trainee accepted, or an application the trainee
 * made to one of that employer's postings. Employers may also talk to a Super
 * Admin for support. Employers never reach other employers, organizations or
 * other staff, and there is no way to message a trainee just because they
 * appear in discovery.
 */
export type PeerKind = "TRAINEE" | "STAFF" | "EMPLOYER";

export interface PairFacts {
  /** Employer-trainee pairs: the trainee accepted an introduction from this employer. */
  acceptedIntroduction?: boolean;
  /** Employer-trainee pairs: the trainee applied to one of this employer's postings. */
  appliedToEmployer?: boolean;
  /** Employer-staff pairs: the staff member is a Super Admin. */
  staffIsSuperAdmin?: boolean;
}

export type PairVerdict = { ok: true } | { ok: false; error: string };

/** Verdict for the employer side of a pair. Other pairs keep their existing route-level checks. */
export function employerPairVerdict(other: PeerKind, facts: PairFacts): PairVerdict {
  if (other === "EMPLOYER") return { ok: false, error: "Employers can't message each other here." };
  if (other === "STAFF") {
    return facts.staffIsSuperAdmin ? { ok: true } : { ok: false, error: "You can only message a Super Admin directly." };
  }
  if (facts.acceptedIntroduction || facts.appliedToEmployer) return { ok: true };
  return { ok: false, error: "You can message a trainee once they have accepted your introduction or applied to one of your jobs." };
}

/** Same pair, seen from the trainee's side. */
export function traineeToEmployerVerdict(facts: PairFacts): PairVerdict {
  return facts.acceptedIntroduction || facts.appliedToEmployer
    ? { ok: true }
    : { ok: false, error: "You can message an employer once you have accepted their introduction or applied to their job." };
}

/** Where a conversation lives for each kind of person, for links in notifications. */
export function conversationPath(kind: PeerKind, conversationId: string): string {
  const base = kind === "TRAINEE" ? "/trainee/messages" : kind === "EMPLOYER" ? "/employer/messages" : "/admin/messages";
  return `${base}/${conversationId}`;
}

/** What a new-message notification says. It never contains the message text. */
export function newMessageNotice(senderName: string): { title: string; body: string } {
  const who = senderName.trim() || "Someone";
  return { title: `New message from ${who}`, body: "Open the conversation to read it." };
}

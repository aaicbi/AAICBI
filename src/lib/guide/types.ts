import type { EcosystemFlags } from "@/lib/ecosystem/flags";

/** An internal link the guide offers. Always a path on this site. */
export interface GuideLink {
  label: string;
  href: string;
}

/** One written question and its answer: built in (code) or added by SUPER_ADMIN (database). */
export interface GuideEntry {
  id: string;
  question: string;
  answer: string;
  links: GuideLink[];
  /** Extra words that should find this answer (synonyms, short names). */
  keywords: string[];
  source: "default" | "custom";
  /** Set when this entry starts a step-by-step guide (see playbooks) instead of giving a short answer. */
  playbookId?: string;
  /** For a playbook: the kind of account it is written for. */
  audience?: "organization" | "trainee";
  /** Approved-knowledge fields (all optional): where the answer sends someone, what to light up, who it is for. */
  dbId?: string;
  category?: string | null;
  navHref?: string | null;
  navLabel?: string | null;
  target?: string | null;
  relatedQuestions?: string[];
  /** Kinds of account this answer is for; empty or missing means everyone. */
  roles?: string[];
}

/** A button under an answer: go to a page, or go there and light up the control it is about. */
export interface GuideAction {
  kind: "go" | "show";
  label: string;
  href: string;
  /** The control to light up (a data-guide-target id). */
  target?: string;
}

export type GuideSwitches = Pick<EcosystemFlags, "orgPages" | "education" | "feed" | "publicJobs" | "publicTrainees">;

/** What the guide says back. */
export interface GuideReply {
  text: string;
  links: GuideLink[];
  /** "answer": a written answer matched. "topic": a skill the platform has was named. "playbook": a step-by-step guide matched. "fallback": nothing matched. */
  kind: "answer" | "topic" | "playbook" | "fallback";
  /** For a "playbook": which guide to walk through. */
  playbookId?: string;
  /** For an "answer": the question that matched, shown as "You asked about ...". */
  matchedQuestion?: string;
  /** Other questions that look similar, offered as buttons. */
  related: string[];
  /** How sure the match was (0 to 1). */
  confidence: number;
  /** An answer was given, but not with enough certainty to be trusted without asking. */
  lowConfidence: boolean;
  /** For a fallback or low-confidence answer: the closest written question, kept for the team. */
  attempted?: string;
  /** "Take me there" and "Show me" buttons, already checked against the account's access. */
  actions: GuideAction[];
  /** Which written answer was used, to count how often it helps. */
  entryDbId?: string;
}

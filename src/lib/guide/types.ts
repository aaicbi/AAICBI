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
}

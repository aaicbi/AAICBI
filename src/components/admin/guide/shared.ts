
export interface Link {
  label: string;
  href: string;
}

export interface EntryDto {
  id: string;
  question: string;
  answer: string;
  links: Link[];
  keywords: string[];
  enabled: boolean;
  category: string | null;
  navHref: string | null;
  navLabel: string | null;
  target: string | null;
  relatedQuestions: string[];
  roles: string[];
  version: number;
  served: number;
  updatedAt: string;
}

export interface Metrics {
  days: number;
  questions: number;
  answered: number;
  unanswered: number;
  lowConfidence: number;
  helpful: number;
  notHelpful: number;
  navigations: number;
  tours: number;
  resolutionRate: number | null;
  averageOpenConfidence: number | null;
  queue: { open: number; inReview: number; answered: number; rejected: number; merged: number; dismissed: number };
  knowledge: { entries: number; addedThisWeek: number };
  topUnanswered: Array<{ id: string; text: string; asked: number; priority: string }>;
  struggles: Array<{ feature: string; asked: number }>;
  mostUsedAnswers: Array<{ id: string; question: string; served: number }>;
}

export interface Payload {
  enabled: boolean;
  entries: EntryDto[];
  metrics: Metrics;
  categories: string[];
  limit: number;
  consultant: ConsultantInfo;
}

export interface QuestionDto {
  id: string;
  text: string;
  variants: string[];
  asked: number;
  status: string;
  reason: string;
  confidence: number | null;
  attempted: string | null;
  roleCounts: Record<string, number>;
  lastRole: string | null;
  lastRoute: string | null;
  lastPage: string | null;
  feature: string | null;
  context: string[];
  category: string | null;
  firstAskedAt: string;
  lastAskedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  entryId: string | null;
  mergedIntoId: string | null;
  priority: "HIGH" | "MEDIUM" | "LOW";
  score: number;
}

export interface Draft {
  question: string;
  answer: string;
  keywords: string;
  related: string;
  links: Link[];
  enabled: boolean;
  category: string;
  navHref: string;
  navLabel: string;
  target: string;
  roles: string[];
  changeNote: string;
}

export const EMPTY_DRAFT: Draft = { question: "", answer: "", keywords: "", related: "", links: [], enabled: true, category: "", navHref: "", navLabel: "", target: "", roles: [], changeNote: "" };

export function draftFrom(e: EntryDto): Draft {
  return {
    question: e.question, answer: e.answer, keywords: e.keywords.join(", "), related: e.relatedQuestions.join("\n"), links: e.links, enabled: e.enabled,
    category: e.category ?? "", navHref: e.navHref ?? "", navLabel: e.navLabel ?? "", target: e.target ?? "", roles: e.roles, changeNote: "",
  };
}

export function draftFromQuestion(q: QuestionDto): Draft {
  return { ...EMPTY_DRAFT, question: q.text.charAt(0).toUpperCase() + q.text.slice(1), related: q.variants.join("\n"), category: q.category ?? "" };
}

/** The request body for saving a draft. The server checks every field again. */
export function bodyOf(d: Draft): Record<string, unknown> {
  return {
    question: d.question,
    answer: d.answer,
    keywords: d.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    relatedQuestions: d.related.split("\n").map((k) => k.trim()).filter(Boolean),
    links: d.links.filter((l) => l.label.trim() && l.href.trim()),
    enabled: d.enabled,
    category: d.category.trim(),
    navHref: d.navHref.trim(),
    navLabel: d.navLabel.trim(),
    target: d.target.trim(),
    roles: d.roles,
    changeNote: d.changeNote.trim() || undefined,
  };
}

export const ROLE_LABEL: Record<string, string> = { trainee: "Trainee", employer: "Employer", investor: "Investor", organization: "Training organization", staff: "Staff", visitor: "Visitor" };
export const PRIORITY_VARIANT = { HIGH: "danger", MEDIUM: "warning", LOW: "neutral" } as const;
export const STATUS_LABEL: Record<string, string> = { OPEN: "Needs review", IN_REVIEW: "In review", ANSWERED: "Answered", DISMISSED: "Dismissed", REJECTED: "Rejected", MERGED: "Merged" };

export const date = (v: string | Date) => new Date(v).toLocaleDateString("en-GB", { dateStyle: "medium" });
export const dateTime = (v: string | Date) => new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export interface SuggestionDto {
  id: string;
  kind: "DRAFT_ANSWER" | "IMPROVE_ANSWER" | "MERGE" | "REJECT" | "ADVICE";
  status: "PENDING" | "APPROVED" | "DISMISSED";
  questionId: string | null;
  entryId: string | null;
  title: string;
  rationale: string;
  proposal: Record<string, unknown>;
  warnings: string[];
  model: string;
  createdAt: string;
  decidedAt: string | null;
  question: { id: string; text: string; asked: number; status: string } | null;
}

export interface ConsultantInfo {
  enabled: boolean;
  configured: boolean;
  pending: number;
}

export interface DraftProposal {
  question: string;
  answer: string;
  category: string | null;
  navHref: string | null;
  navLabel: string | null;
  target: string | null;
  roles: string[];
  relatedQuestions: string[];
  keywords: string[];
}

/** A consultant's proposed answer as the form's draft. The note records that Claude drafted it and a person approved it. */
export function draftFromProposal(p: DraftProposal): Draft {
  return {
    question: p.question, answer: p.answer, keywords: p.keywords.join(", "), related: p.relatedQuestions.join("\n"), links: [], enabled: true,
    category: p.category ?? "", navHref: p.navHref ?? "", navLabel: p.navLabel ?? "", target: p.target ?? "", roles: p.roles,
    changeNote: "Drafted by the Claude consultant; reviewed and approved by a super admin",
  };
}

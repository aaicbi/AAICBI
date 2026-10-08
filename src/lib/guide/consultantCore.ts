import { z } from "zod";
import { CONTROL_TARGETS } from "@/lib/guide/controlTargets";
import { GUIDE_CATEGORIES, GUIDE_ROLES } from "@/lib/guide/adminSchemas";
import { GUIDE_DESTINATIONS } from "@/lib/guide/navigation";

/**
 * The Claude consultant's rules, with no network or database so they can be
 * tested. It is an adviser to the super admin for Loop's knowledge, nothing
 * more:
 *   - it runs only when a super admin presses a button, and only when the
 *     switch is on;
 *   - it sees only scrubbed question text, counts and the written answers,
 *     never anyone's identity;
 *   - it can only return proposals. Nothing it returns is used by Loop until
 *     a super admin reviews it and saves it through the normal answer form;
 *   - a proposal naming a page or control that does not exist has that part
 *     removed before anyone sees it.
 */
export type Availability = "ready" | "off" | "not_configured";

export function consultantAvailability(s: { enabled: boolean; hasKey: boolean }): Availability {
  if (!s.enabled) return "off";
  return s.hasKey ? "ready" : "not_configured";
}

export const REVIEW_MAX_QUESTIONS = 12;
export const REVIEW_MAX_ENTRIES = 80;
export const ANSWER_MAX = 600;

export const KNOWN_PAGES = new Set(GUIDE_DESTINATIONS.map((d) => d.href));
export const KNOWN_TARGETS = new Set([...GUIDE_DESTINATIONS.map((d) => d.target), ...CONTROL_TARGETS.map((c) => c.id)]);

export interface ContextQuestion {
  text: string;
  variants: string[];
  asked: number;
  roleCounts: Record<string, number>;
  feature: string | null;
  confidence: number | null;
  attempted: string | null;
  reason: string;
}
export interface ContextEntry {
  question: string;
  answer: string;
  category: string | null;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/**
 * The text sent to Claude for a review. Questions and answers are given short
 * references (Q1, A1), not database ids; the route maps replies back. No
 * account identity exists in this data to begin with.
 */
export function buildReviewContext(questions: ContextQuestion[], entries: ContextEntry[]): string {
  const q = questions.slice(0, REVIEW_MAX_QUESTIONS).map((x, i) => {
    const roles = Object.entries(x.roleCounts).map(([r, n]) => `${r} ${n}`).join(", ") || "unknown";
    const parts = [`Q${i + 1}: "${clip(x.text, 200)}"`, `asked ${x.asked} time(s) by: ${roles}`, `why queued: ${x.reason}`];
    if (x.feature) parts.push(`area: ${x.feature}`);
    if (x.confidence !== null) parts.push(`confidence: ${Math.round(x.confidence * 100)}%`);
    if (x.attempted) parts.push(`closest existing answer: "${clip(x.attempted, 120)}"`);
    if (x.variants.length) parts.push(`also asked as: ${x.variants.slice(0, 5).map((v) => `"${clip(v, 120)}"`).join("; ")}`);
    return parts.join(" | ");
  });
  const a = entries.slice(0, REVIEW_MAX_ENTRIES).map((x, i) => `A${i + 1}: "${clip(x.question, 120)}" -> ${clip(x.answer, 160)}`);
  const pages = GUIDE_DESTINATIONS.map((d) => `${d.href} (${d.label}; for ${d.audience.join("/")})`);
  return [
    "QUESTIONS WAITING FOR REVIEW",
    q.join("\n") || "(none)",
    "",
    "EXISTING APPROVED ANSWERS",
    a.join("\n") || "(none)",
    "",
    "PAGES THAT EXIST (the only values allowed for navHref)",
    pages.join("\n"),
    "",
    "CONTROLS THAT CAN BE POINTED AT (the only values allowed for target)",
    [...CONTROL_TARGETS.map((c) => `${c.id} (${c.label})`), "nav:<one of the pages above> (its menu item)"].join("\n"),
    "",
    `CATEGORIES: ${GUIDE_CATEGORIES.join(", ")}`,
  ].join("\n");
}

export const REVIEW_SYSTEM_PROMPT = `You are a consultant to the Super Admin of the AAICBI learning platform. Your only job is to advise on how to make "Loop", the platform's guide bot, answer visitors' questions well. Loop answers only from written answers a human approved; you never change Loop and cannot. Everything you return is a PROPOSAL for the Super Admin to read, edit and approve or dismiss.

You are given questions Loop could not answer, the answers it already has, the pages and controls that exist, and categories.

For each waiting question, choose one action:
- draft_answer: write an answer in plain, friendly words (under 600 characters) that a first-time visitor can follow.
- merge_into_existing: the question is already covered by an existing answer (give its reference, A1...); suggest it as another way of asking.
- reject: the question should not be answered by the guide (off-topic, asks for exams or assignment answers, personal data, abusive).
- needs_human: you do not have enough information to answer safely.

Rules you must follow:
- NEVER invent how the platform works. State only what the supplied answers, pages and controls support. If the true answer depends on something you were not told (a price, a policy, a date, whether a feature exists), choose needs_human, or draft the answer and list exactly what must be checked in verifyBeforeApproving.
- Never put prices, dates, deadlines or numbers that may change in an answer.
- navHref must be copied exactly from the list of pages that exist, or left empty. target must be copied exactly from the controls list (or "nav:" plus one listed page), or left empty. Only add them when the answer is about getting to that place.
- roles: name the kinds of account the answer is for (trainee, employer, investor, organization, staff) only when it clearly applies to some and not others; otherwise leave empty.
- Write relatedQuestions as other natural ways people would ask the same thing.
- Never ask for, repeat or guess personal data. Exam and assignment questions are never answered.
- Be honest about uncertainty: set confidence to low when unsure.
Call submit_review exactly once with one item per waiting question you were given.`;

export const ASK_SYSTEM_PROMPT = `You are a consultant to the Super Admin of the AAICBI learning platform, advising on Loop, the platform's guide bot, and on what visitors' questions reveal about the product. You are given real numbers about Loop and the questions it could not answer. You have no tools that change anything and you never claim to have changed anything.

Rules:
- Ground every number and claim in the data given. If the data is too thin to say, say so.
- State what the data shows, not why it happened: questions clustering around a part of the product can mean it is hard to find or unclear, but you cannot prove a cause. Suggest what the team could check or try.
- Advice is for a human to act on. Phrase it as suggestions. Be concrete (which area, which wording, which answer to write) and concise: short paragraphs or a short list.
- Never invent features, pages or policies. Never ask for or repeat personal data.
Call give_advice exactly once.`;

export const SUBMIT_REVIEW_TOOL = {
  name: "submit_review",
  description: "Submit your proposals, one per waiting question. Nothing is applied: the Super Admin reviews each one.",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ref: { type: "string", description: "The question reference, for example Q1." },
            action: { type: "string", enum: ["draft_answer", "merge_into_existing", "reject", "needs_human"] },
            rationale: { type: "string", description: "One or two sentences on why, for the Super Admin." },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            verifyBeforeApproving: { type: "array", items: { type: "string" }, description: "Facts the Super Admin must check before approving." },
            mergeRef: { type: "string", description: "For merge_into_existing: the existing answer reference, for example A3." },
            draft: {
              type: "object",
              description: "For draft_answer only.",
              properties: {
                question: { type: "string" },
                answer: { type: "string" },
                category: { type: "string" },
                navHref: { type: "string" },
                navLabel: { type: "string" },
                target: { type: "string" },
                roles: { type: "array", items: { type: "string" } },
                relatedQuestions: { type: "array", items: { type: "string" } },
                keywords: { type: "array", items: { type: "string" } },
              },
              required: ["question", "answer"],
            },
          },
          required: ["ref", "action", "rationale", "confidence"],
        },
      },
    },
    required: ["items"],
  },
};

export const GIVE_ADVICE_TOOL = {
  name: "give_advice",
  description: "Deliver your advice to the Super Admin.",
  input_schema: {
    type: "object" as const,
    properties: {
      advice: { type: "string", description: "The advice, in short paragraphs or a short list." },
      nextSteps: { type: "array", items: { type: "string" }, description: "0 to 5 concrete things the team could do." },
    },
    required: ["advice"],
  },
};

const DraftSchema = z.object({
  question: z.string().default(""),
  answer: z.string().default(""),
  category: z.string().optional(),
  navHref: z.string().optional(),
  navLabel: z.string().optional(),
  target: z.string().optional(),
  roles: z.array(z.string()).optional(),
  relatedQuestions: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

export const ReviewItemSchema = z.object({
  ref: z.string(),
  action: z.enum(["draft_answer", "merge_into_existing", "reject", "needs_human"]),
  rationale: z.string().default(""),
  confidence: z.enum(["high", "medium", "low"]).default("low"),
  verifyBeforeApproving: z.array(z.string()).optional(),
  mergeRef: z.string().optional(),
  draft: DraftSchema.optional(),
});
export const ReviewResultSchema = z.object({ items: z.array(ReviewItemSchema).max(40) });
export const AdviceSchema = z.object({ advice: z.string().min(1), nextSteps: z.array(z.string()).max(8).optional() });

export type SuggestionKind = "DRAFT_ANSWER" | "IMPROVE_ANSWER" | "MERGE" | "REJECT" | "ADVICE";

export interface Draft {
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

export interface CleanSuggestion {
  kind: SuggestionKind;
  /** Which waiting question (Q1...) or existing answer it is about. */
  questionRef: string | null;
  entryRef: string | null;
  title: string;
  rationale: string;
  proposal: Record<string, unknown>;
  warnings: string[];
}

const CHANGEABLE = /(?:₦|\bNGN\b|\$\s?\d|\bUSD\b|\d+\s?%|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\b20\d{2}\b|\b\d+\s+(?:days?|weeks?|months?|hours?)\b)/i;
const AUTOMATIC = "Drafted by Claude. Check the facts before approving: only you can confirm how the platform really works.";

/** Cleans one proposed draft: keeps only real pages and controls, trims to limits, and says what it changed. */
export function cleanDraft(raw: z.infer<typeof DraftSchema>, fallbackQuestion: string): { draft: Draft; warnings: string[] } {
  const warnings: string[] = [];
  const take = (v: string | undefined, max: number) => (v ?? "").trim().slice(0, max);
  let answer = take(raw.answer, 5000);
  if (answer.length > ANSWER_MAX) {
    answer = answer.slice(0, ANSWER_MAX - 1).trimEnd() + "…";
    warnings.push(`The draft was longer than ${ANSWER_MAX} characters and was shortened; read the end.`);
  }
  let navHref: string | null = take(raw.navHref, 200) || null;
  if (navHref && !KNOWN_PAGES.has(navHref)) {
    warnings.push(`Claude named a page that does not exist (${navHref}); it was removed.`);
    navHref = null;
  }
  let target: string | null = take(raw.target, 80) || null;
  if (target && !KNOWN_TARGETS.has(target)) {
    warnings.push(`Claude named a control that cannot be pointed at (${target}); it was removed.`);
    target = null;
  }
  if (target && !navHref) {
    warnings.push("A control to point at was suggested without a page; it was removed.");
    target = null;
  }
  const roles = [...new Set((raw.roles ?? []).filter((r): r is (typeof GUIDE_ROLES)[number] => (GUIDE_ROLES as readonly string[]).includes(r)))];
  if ((raw.roles ?? []).length > roles.length) warnings.push("Some audiences Claude named do not exist and were removed.");
  if (CHANGEABLE.test(answer)) warnings.push("The draft mentions a price, date or number that may change. Loop's answers should avoid those: consider removing it.");
  const category = take(raw.category, 40) || null;
  const list = (a: string[] | undefined, n: number, len: number) => [...new Set((a ?? []).map((x) => x.trim().slice(0, len)).filter((x) => x.length >= 3))].slice(0, n);
  return {
    draft: {
      question: take(raw.question, 200) || fallbackQuestion,
      answer,
      category,
      navHref,
      navLabel: navHref ? take(raw.navLabel, 40) || null : null,
      target,
      roles,
      relatedQuestions: list(raw.relatedQuestions, 8, 200),
      keywords: list(raw.keywords, 10, 40),
    },
    warnings,
  };
}

/**
 * Turns one item from Claude into a suggestion safe to show: an unknown
 * reference becomes "needs a human", a draft is cleaned, and a draft with no
 * usable answer is not offered at all. The automatic warning is always there.
 */
export function cleanReviewItem(item: z.infer<typeof ReviewItemSchema>, ctx: { questions: Map<string, { text: string }>; entries: Map<string, { question: string }> }): CleanSuggestion | null {
  const q = ctx.questions.get(item.ref.toUpperCase());
  if (!q) return null;
  const verify = (item.verifyBeforeApproving ?? []).map((v) => v.trim()).filter(Boolean).slice(0, 6);
  const warnings = [AUTOMATIC, ...verify.map((v) => `Check: ${v}`)];
  if (item.confidence === "low") warnings.push("Claude marked this low confidence.");
  const base = { questionRef: item.ref.toUpperCase(), entryRef: null as string | null, rationale: item.rationale.trim().slice(0, 600) };

  if (item.action === "draft_answer") {
    const { draft, warnings: w } = cleanDraft(item.draft ?? { question: "", answer: "" }, q.text.charAt(0).toUpperCase() + q.text.slice(1));
    if (draft.answer.length < 10) return { kind: "ADVICE", ...base, title: `No usable draft for "${q.text}"`, proposal: { advice: base.rationale || "Claude could not write a safe answer; this needs a human.", confidence: item.confidence }, warnings };
    return { kind: "DRAFT_ANSWER", ...base, title: `Draft answer for "${q.text}"`, proposal: { draft, confidence: item.confidence }, warnings: [...warnings, ...w] };
  }
  if (item.action === "merge_into_existing") {
    const e = item.mergeRef ? ctx.entries.get(item.mergeRef.toUpperCase()) : undefined;
    if (!e) return { kind: "ADVICE", ...base, title: `Possible duplicate: "${q.text}"`, proposal: { advice: base.rationale || "Claude thought this was covered by an existing answer but did not name a valid one.", confidence: item.confidence }, warnings };
    return { kind: "MERGE", ...base, entryRef: item.mergeRef!.toUpperCase(), title: `"${q.text}" is already covered by "${e.question}"`, proposal: { entryQuestion: e.question, confidence: item.confidence }, warnings };
  }
  if (item.action === "reject") return { kind: "REJECT", ...base, title: `Reject "${q.text}"`, proposal: { confidence: item.confidence }, warnings };
  return { kind: "ADVICE", ...base, title: `Needs a human: "${q.text}"`, proposal: { advice: base.rationale || "Claude did not have enough information to answer this safely.", confidence: item.confidence }, warnings };
}

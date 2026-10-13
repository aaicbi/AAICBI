import { z } from "zod";
import { FEATURE_KEYS, AI_FEATURES, NOTE_MAX, validateNote } from "@/lib/guide/aiGuidanceCore";

/**
 * The consultant's reports, material reviews and AI-training proposals: the
 * prompts, the tools Claude must answer through, and the clean-up applied to
 * whatever it returns. No network or database, so it can be tested. As with
 * the answer review, everything here is a PROPOSAL; nothing is applied until
 * a super admin approves it.
 */
export const REPORT_AREAS = ["analytics", "materials", "assessments", "performance"] as const;
export const MATERIAL_TEXT_MAX = 12_000;
const AUTOMATIC = "Written by Claude from aggregate numbers. Check the facts before you act: only you can confirm what really happened.";

const COMMON_RULES = `Rules:
- Ground every number and claim in the data given. If the data is too thin to say, say so; never invent figures.
- State what the data shows, not why it happened. You cannot prove a cause; suggest what the team could check.
- You see aggregate numbers only. Never ask for, guess or repeat anyone's identity.
- You change nothing and never claim to have. Everything is a suggestion for a human to decide.
- Be concrete and brief.`;

export const REPORT_SYSTEM_PROMPT = `You are a consultant to the Super Admin of the AAICBI learning platform. You are given a snapshot of the platform's analytics, the lesson materials in its courses, its assessments and trainee performance, plus signals already flagged by simple rules. Write a short report: what is going well, what needs attention (most important first), and what to do next. Each finding names the area it is about and, where the data supports it, the course.
${COMMON_RULES}
Call submit_report exactly once.`;

export const MATERIAL_SYSTEM_PROMPT = `You are a consultant to the Super Admin of the AAICBI learning platform, reviewing the written lesson materials of ONE module. Check whether they are clear for a first-time learner, whether the structure is sensible, whether anything seems missing, contradictory or confusing, and whether the module's assessment performance (if given) suggests a topic that is taught too thinly. Quote short phrases to point at a place; never rewrite the whole material.
${COMMON_RULES}
- You only know what the text shows. Do not claim facts about the world are wrong unless the text contradicts itself.
Call submit_material_review exactly once.`;

export const TRAINING_SYSTEM_PROMPT = `You are a consultant to the Super Admin of the AAICBI learning platform. You help write a short GUIDANCE NOTE for one of the platform's AI features. The note is added after the feature's own fixed rules and can only adjust tone, emphasis, level of detail and local context. It can NEVER change what the feature is allowed to do, loosen a safety rule, give exam or assignment answers, change marks or reveal anything.
Write the note as plain instructions in the second person ("Use simple English..."). Keep it under ${NOTE_MAX} characters. Base it on the Super Admin's goal and the data given; if the data does not support a change, say so and keep the note modest.
${COMMON_RULES}
Call submit_training exactly once.`;

const str = (d: string) => ({ type: "string", description: d });

export const SUBMIT_REPORT_TOOL = {
  name: "submit_report",
  description: "Deliver the platform report. Nothing is changed.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: str("Two or three sentences: the overall picture."),
      goingWell: { type: "array", items: { type: "string" }, description: "Up to 4 things that look healthy." },
      findings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            area: { type: "string", enum: [...REPORT_AREAS] },
            course: str("Course title if the finding is about one course."),
            finding: str("What the data shows."),
            suggestion: str("What the team could check or try."),
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["area", "finding", "suggestion", "priority"],
        },
      },
    },
    required: ["summary", "findings"],
  },
};

export const SUBMIT_MATERIAL_REVIEW_TOOL = {
  name: "submit_material_review",
  description: "Deliver the review of this module's lesson materials. Nothing is changed.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: str("Two or three sentences on the overall quality."),
      strengths: { type: "array", items: { type: "string" } },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            material: str("Title of the material it is about."),
            quote: str("A short phrase from the text that shows it."),
            issue: str("What is unclear, missing or inconsistent."),
            suggestion: str("How the author could improve it."),
            priority: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["issue", "suggestion", "priority"],
        },
      },
    },
    required: ["summary", "issues"],
  },
};

export const SUBMIT_TRAINING_TOOL = {
  name: "submit_training",
  description: "Propose a guidance note for the AI feature. Nothing is saved until the Super Admin approves it.",
  input_schema: {
    type: "object" as const,
    properties: {
      note: str(`The proposed note, under ${NOTE_MAX} characters.`),
      rationale: str("One or two sentences on why this note helps."),
      verifyBeforeApproving: { type: "array", items: { type: "string" }, description: "Things the Super Admin should check." },
    },
    required: ["note", "rationale"],
  },
};

const Priority = z.enum(["high", "medium", "low"]).catch("medium");
export const ReportSchema = z.object({
  summary: z.string().default(""),
  goingWell: z.array(z.string()).optional(),
  findings: z.array(z.object({ area: z.string(), course: z.string().optional(), finding: z.string(), suggestion: z.string().default(""), priority: Priority })).max(30),
});
export const MaterialReviewSchema = z.object({
  summary: z.string().default(""),
  strengths: z.array(z.string()).optional(),
  issues: z.array(z.object({ material: z.string().optional(), quote: z.string().optional(), issue: z.string(), suggestion: z.string().default(""), priority: Priority })).max(30),
});
export const TrainingSchema = z.object({ note: z.string(), rationale: z.string().default(""), verifyBeforeApproving: z.array(z.string()).optional() });

const take = (v: string | undefined, n: number) => (v ?? "").trim().slice(0, n);
const list = (a: string[] | undefined, n: number, len: number) => (a ?? []).map((x) => take(x, len)).filter(Boolean).slice(0, n);
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

export interface CleanReport {
  title: string;
  rationale: string;
  proposal: { summary: string; goingWell: string[]; findings: Array<{ area: (typeof REPORT_AREAS)[number]; course: string | null; finding: string; suggestion: string; priority: "high" | "medium" | "low" }> };
  warnings: string[];
}

/** Keeps only findings about the four areas, with real text, most important first. */
export function cleanReport(raw: z.infer<typeof ReportSchema>, periodDays: number, courseTitles: string[] = []): CleanReport {
  const warnings = [AUTOMATIC];
  const known = new Set(courseTitles.map((t) => t.toLowerCase()));
  let dropped = 0;
  const findings = raw.findings
    .map((f) => {
      const area = (REPORT_AREAS as readonly string[]).includes(f.area) ? (f.area as (typeof REPORT_AREAS)[number]) : null;
      const finding = take(f.finding, 500);
      if (!area || finding.length < 5) {
        dropped++;
        return null;
      }
      const course = take(f.course, 120) || null;
      return { area, course: course && (known.size === 0 || known.has(course.toLowerCase())) ? course : null, finding, suggestion: take(f.suggestion, 500), priority: f.priority };
    })
    .filter((f): f is NonNullable<typeof f> => !!f)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 20);
  if (dropped) warnings.push(`${dropped} finding${dropped === 1 ? "" : "s"} Claude returned could not be used and ${dropped === 1 ? "was" : "were"} removed.`);
  return {
    title: `Platform report, last ${periodDays} days`,
    rationale: "Claude's reading of the numbers below.",
    proposal: { summary: take(raw.summary, 800), goingWell: list(raw.goingWell, 4, 300), findings },
    warnings,
  };
}

export function cleanMaterialReview(raw: z.infer<typeof MaterialReviewSchema>, label: string, skipped: number): { title: string; rationale: string; proposal: Record<string, unknown>; warnings: string[] } {
  const warnings = [AUTOMATIC, "Claude read only the text of the Word, PDF and PowerPoint files, in the part shown to it. It cannot see videos or pictures."];
  if (skipped > 0) warnings.push(`${skipped} material${skipped === 1 ? " was" : "s were"} not read (not a Word document, or not reachable).`);
  const issues = raw.issues
    .map((i) => ({ material: take(i.material, 120) || null, quote: take(i.quote, 200) || null, issue: take(i.issue, 500), suggestion: take(i.suggestion, 500), priority: i.priority }))
    .filter((i) => i.issue.length >= 5)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .slice(0, 20);
  return { title: `Materials review: ${label}`, rationale: "Claude's reading of the lesson text.", proposal: { summary: take(raw.summary, 800), strengths: list(raw.strengths, 4, 300), issues }, warnings };
}

export function cleanTraining(raw: z.infer<typeof TrainingSchema>, feature: string): { ok: true; title: string; rationale: string; proposal: { feature: string; note: string }; warnings: string[] } | { ok: false; error: string } {
  if (!FEATURE_KEYS.includes(feature)) return { ok: false, error: "That AI feature cannot be trained." };
  const v = validateNote(raw.note.trim().slice(0, NOTE_MAX));
  if (!v.ok) return { ok: false, error: `Claude's proposed note was not usable (${v.error}) and was discarded. Nothing was changed.` };
  const label = AI_FEATURES.find((f) => f.key === feature)!.label;
  const warnings = [AUTOMATIC, ...list(raw.verifyBeforeApproving, 5, 250).map((x) => `Check: ${x}`), "This note only adjusts tone and emphasis. The feature's own rules still apply and cannot be changed by it."];
  return { ok: true, title: `Guidance note for ${label}`, rationale: take(raw.rationale, 600), proposal: { feature, note: v.note }, warnings };
}

export function materialsContext(label: string, texts: Array<{ title: string; text: string }>, performance: string): string {
  let budget = MATERIAL_TEXT_MAX;
  const parts: string[] = [];
  for (const t of texts) {
    if (budget <= 0) break;
    const share = Math.max(500, Math.floor(budget / Math.max(1, texts.length - parts.length)));
    const body = t.text.replace(/\s+\n/g, "\n").trim().slice(0, Math.min(budget, share));
    budget -= body.length;
    parts.push(`MATERIAL "${t.title.slice(0, 100)}"${body.length < t.text.trim().length ? " (shortened)" : ""}\n${body}`);
  }
  return [`MODULE: ${label}`, performance ? `ASSESSMENT PERFORMANCE: ${performance}` : "ASSESSMENT PERFORMANCE: no data", "", ...parts].join("\n");
}

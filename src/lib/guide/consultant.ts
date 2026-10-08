import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { priorityOf } from "@/lib/guide/priority";
import { sortQueue, toQueueRow, guideMetrics } from "@/lib/guide/knowledge";
import {
  ASK_SYSTEM_PROMPT, AdviceSchema, GIVE_ADVICE_TOOL, REVIEW_MAX_ENTRIES, REVIEW_MAX_QUESTIONS, REVIEW_SYSTEM_PROMPT, ReviewResultSchema, SUBMIT_REVIEW_TOOL,
  buildReviewContext, cleanReviewItem, consultantAvailability, type Availability, type CleanSuggestion,
} from "@/lib/guide/consultantCore";

/**
 * The Claude consultant for Loop's knowledge. Advice only: it reads the
 * review queue and the approved answers, asks Claude for proposals, and
 * stores them as suggestions. It never writes an answer, never changes a
 * question's status and never runs by itself: only a super admin pressing a
 * button, with the switch on. Uses the platform's existing Anthropic account
 * (ANTHROPIC_API_KEY), so usage is billed there like the other AI features.
 */
export const CONSULTANT_MODEL = process.env.GUIDE_CONSULTANT_MODEL || "claude-sonnet-4-5";
const TIMEOUT_MS = 60_000;

export interface ClaudeClient {
  messages: { create: (args: Anthropic.MessageCreateParamsNonStreaming, opts?: { timeout?: number }) => Promise<Anthropic.Message> };
}

export function realClient(): ClaudeClient {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1 }) as unknown as ClaudeClient;
}

export async function consultantState(): Promise<{ enabled: boolean; configured: boolean; availability: Availability }> {
  const s = await prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideConsultantEnabled: true } }).catch(() => null);
  const enabled = s?.guideConsultantEnabled ?? false;
  const configured = !!process.env.ANTHROPIC_API_KEY;
  return { enabled, configured, availability: consultantAvailability({ enabled, hasKey: configured }) };
}

function toolInput(msg: Anthropic.Message, name: string): unknown {
  const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === name);
  return block?.input;
}

export class ConsultantError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function ask(client: ClaudeClient, args: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  try {
    return await client.messages.create(args, { timeout: TIMEOUT_MS });
  } catch (e) {
    console.error("Guide consultant: Claude request failed:", e instanceof Error ? e.message : e);
    throw new ConsultantError("Claude could not be reached just now. Nothing was changed. Try again in a minute.");
  }
}

async function logRun(askedById: string, question: string, answer: string) {
  await prisma.aiCommandLog.create({ data: { askedById, question, answer: answer.slice(0, 2000), toolCalls: [] as unknown as object } }).catch((e) => console.error("Failed to write AiCommandLog:", e));
}

/**
 * Asks Claude to review waiting questions and stores its proposals. With
 * `questionIds`, only those questions; otherwise the highest-priority ones
 * that do not already have a proposal waiting.
 */
export async function reviewQueue(client: ClaudeClient, adminId: string, questionIds?: string[]): Promise<{ created: number; message: string }> {
  const pending = await prisma.guideSuggestion.findMany({ where: { status: "PENDING", questionId: { not: null } }, select: { questionId: true } });
  const have = new Set(pending.map((p) => p.questionId));
  const rows = await prisma.guideUnanswered.findMany({ where: { status: { in: ["OPEN", "IN_REVIEW"] }, ...(questionIds?.length ? { id: { in: questionIds } } : {}) }, take: 300 });
  const waiting = sortQueue(rows.map(toQueueRow)).filter((r) => (questionIds?.length ? true : !have.has(r.id))).slice(0, REVIEW_MAX_QUESTIONS);
  if (waiting.length === 0) return { created: 0, message: "No waiting questions need a proposal." };
  const entries = await prisma.guideEntry.findMany({ where: { enabled: true }, orderBy: { served: "desc" }, take: REVIEW_MAX_ENTRIES, select: { id: true, question: true, answer: true, category: true } });

  const context = buildReviewContext(
    waiting.map((r) => ({ text: r.text, variants: r.variants, asked: r.asked, roleCounts: r.roleCounts, feature: r.feature, confidence: r.confidence, attempted: r.attempted, reason: r.reason })),
    entries,
  );
  const msg = await ask(client, {
    model: CONSULTANT_MODEL,
    max_tokens: 4000,
    system: REVIEW_SYSTEM_PROMPT,
    tools: [SUBMIT_REVIEW_TOOL],
    tool_choice: { type: "tool", name: "submit_review" },
    messages: [{ role: "user", content: context }],
  });
  const parsed = ReviewResultSchema.safeParse(toolInput(msg, "submit_review"));
  if (!parsed.success) throw new ConsultantError("Claude's reply could not be read. Nothing was changed. Try again.");

  const qMap = new Map(waiting.map((r, i) => [`Q${i + 1}`, r]));
  const eMap = new Map(entries.map((e, i) => [`A${i + 1}`, e]));
  const clean: Array<CleanSuggestion & { questionId: string | null; entryId: string | null }> = [];
  const seen = new Set<string>();
  for (const item of parsed.data.items) {
    const ref = item.ref.toUpperCase();
    if (seen.has(ref)) continue;
    const c = cleanReviewItem(item, { questions: new Map([...qMap].map(([k, v]) => [k, { text: v.text }])), entries: new Map([...eMap].map(([k, v]) => [k, { question: v.question }])) });
    if (!c) continue;
    seen.add(ref);
    clean.push({ ...c, questionId: qMap.get(ref)?.id ?? null, entryId: c.entryRef ? eMap.get(c.entryRef)?.id ?? null : null });
  }
  if (clean.length === 0) throw new ConsultantError("Claude did not return anything usable. Nothing was changed.");

  // A new proposal replaces an older waiting one for the same question.
  await prisma.$transaction([
    prisma.guideSuggestion.updateMany({ where: { status: "PENDING", questionId: { in: clean.map((c) => c.questionId).filter((x): x is string => !!x) } }, data: { status: "DISMISSED", decidedAt: new Date(), decidedById: adminId } }),
    ...clean.map((c) =>
      prisma.guideSuggestion.create({
        data: { kind: c.kind, questionId: c.questionId, entryId: c.entryId, title: c.title, rationale: c.rationale, proposal: c.proposal as Prisma.InputJsonValue, warnings: c.warnings, model: CONSULTANT_MODEL },
      }),
    ),
  ]);
  await logRun(adminId, `Guide consultant: review ${waiting.length} waiting question(s)`, `Stored ${clean.length} proposal(s) for review.`);
  return { created: clean.length, message: `Claude prepared ${clean.length} proposal${clean.length === 1 ? "" : "s"} for you to review.` };
}

/** Advice on a question the super admin asks about Loop and what visitors struggle with. */
export async function askConsultant(client: ClaudeClient, adminId: string, question: string) {
  const [metrics, rows] = await Promise.all([
    guideMetrics(),
    prisma.guideUnanswered.findMany({ where: { status: { in: ["OPEN", "IN_REVIEW"] } }, orderBy: { asked: "desc" }, take: 25 }),
  ]);
  const waiting = sortQueue(rows.map(toQueueRow)).slice(0, 15);
  const facts = [
    `Last ${metrics.days} days: ${metrics.questions} questions asked, ${metrics.answered} answered, ${metrics.unanswered} could not be answered, ${metrics.lowConfidence} answered with low confidence. Resolution rate: ${metrics.resolutionRate ?? "n/a"}%. Marked helpful: ${metrics.helpful}; not helpful: ${metrics.notHelpful}. "Take me there / Show me" used ${metrics.navigations} times; guided tours started ${metrics.tours} times.`,
    `Approved answers: ${metrics.knowledge.entries} (${metrics.knowledge.addedThisWeek} added this week). Waiting for review: ${metrics.queue.open + metrics.queue.inReview}.`,
    `Where unanswered questions come from (area: asks): ${metrics.struggles.map((s) => `${s.feature}: ${s.asked}`).join("; ") || "no data"}.`,
    `Most answers given: ${metrics.mostUsedAnswers.map((a) => `"${a.question}" (${a.served})`).join("; ") || "no data"}.`,
    "Waiting questions (priority, asks, text):",
    ...waiting.map((r) => `- ${priorityOf({ asked: r.asked, lastAskedAt: r.lastAskedAt, roleCounts: r.roleCounts, text: r.text, reason: r.reason }).level} | ${r.asked} | "${r.text}"${r.feature ? ` | area ${r.feature}` : ""}`),
  ].join("\n");
  const msg = await ask(client, {
    model: CONSULTANT_MODEL,
    max_tokens: 1500,
    system: ASK_SYSTEM_PROMPT,
    tools: [GIVE_ADVICE_TOOL],
    tool_choice: { type: "tool", name: "give_advice" },
    messages: [{ role: "user", content: `DATA\n${facts}\n\nQUESTION FROM THE SUPER ADMIN\n${question}` }],
  });
  const parsed = AdviceSchema.safeParse(toolInput(msg, "give_advice"));
  if (!parsed.success) throw new ConsultantError("Claude's reply could not be read. Nothing was changed. Try again.");
  const row = await prisma.guideSuggestion.create({
    data: {
      kind: "ADVICE",
      title: question.slice(0, 160),
      rationale: "Your question to the consultant.",
      proposal: { advice: parsed.data.advice.slice(0, 4000), nextSteps: (parsed.data.nextSteps ?? []).map((s) => s.slice(0, 300)) } as Prisma.InputJsonValue,
      warnings: ["Advice from Claude, based only on the numbers shown to it. Check anything you act on."],
      model: CONSULTANT_MODEL,
    },
  });
  await logRun(adminId, `Guide consultant: ${question}`, parsed.data.advice);
  return row;
}

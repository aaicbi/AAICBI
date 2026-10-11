import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildSnapshot } from "@/lib/guide/snapshot";
import { deriveSignals, snapshotContext } from "@/lib/guide/monitorCore";
import { getModuleMaterialsText } from "@/lib/parsing/moduleMaterialsText";
import { AI_FEATURES } from "@/lib/guide/aiGuidanceCore";
import { currentNote } from "@/lib/guide/aiGuidance";
import { CONSULTANT_MODEL, ConsultantError, askClaude, logRun, toolInput, type ClaudeClient } from "@/lib/guide/consultant";
import {
  MATERIAL_SYSTEM_PROMPT, MaterialReviewSchema, REPORT_SYSTEM_PROMPT, ReportSchema, SUBMIT_MATERIAL_REVIEW_TOOL, SUBMIT_REPORT_TOOL, SUBMIT_TRAINING_TOOL,
  TRAINING_SYSTEM_PROMPT, TrainingSchema, cleanMaterialReview, cleanReport, cleanTraining, materialsContext,
} from "@/lib/guide/consultantReportCore";

/**
 * Reports, materials reviews and AI-training proposals from the Claude
 * consultant. Like the answer review, this only READS the platform and stores
 * proposals as suggestions; it never writes a guidance note, an answer or any
 * course content. A super admin presses a button, and the switch must be on.
 */
const store = (kind: string, c: { title: string; rationale: string; proposal: unknown; warnings: string[] }) =>
  prisma.guideSuggestion.create({ data: { kind, title: c.title, rationale: c.rationale, proposal: c.proposal as Prisma.InputJsonValue, warnings: c.warnings, model: CONSULTANT_MODEL } });

export async function platformReport(client: ClaudeClient, adminId: string, periodDays = 30) {
  const snap = await buildSnapshot(periodDays);
  const signals = deriveSignals(snap);
  const msg = await askClaude(client, {
    model: CONSULTANT_MODEL,
    max_tokens: 3000,
    system: REPORT_SYSTEM_PROMPT,
    tools: [SUBMIT_REPORT_TOOL],
    tool_choice: { type: "tool", name: "submit_report" },
    messages: [{ role: "user", content: snapshotContext(snap, signals) }],
  } satisfies Anthropic.MessageCreateParamsNonStreaming);
  const parsed = ReportSchema.safeParse(toolInput(msg, "submit_report"));
  if (!parsed.success) throw new ConsultantError("Claude's reply could not be read. Nothing was changed. Try again.");
  const clean = cleanReport(parsed.data, periodDays, snap.courses.map((c) => c.title));
  if (clean.proposal.findings.length === 0 && !clean.proposal.summary) throw new ConsultantError("Claude did not return anything usable. Nothing was changed.");
  const row = await store("REPORT", clean);
  await logRun(adminId, `Guide consultant: platform report (${periodDays} days)`, clean.proposal.summary);
  return row;
}

/** Courses and modules a super admin can choose to have reviewed. */
export async function materialChoices() {
  const courses = await prisma.course.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { title: "asc" },
    take: 60,
    select: { id: true, title: true, modules: { orderBy: { order: "asc" }, select: { id: true, title: true, lessons: { select: { _count: { select: { materials: true } } } } } } },
  });
  return courses.map((c) => ({ id: c.id, title: c.title, modules: c.modules.map((m) => ({ id: m.id, title: m.title, materials: m.lessons.reduce((n, l) => n + l._count.materials, 0) })) }));
}

export async function reviewModuleMaterials(client: ClaudeClient, adminId: string, moduleId: string) {
  const mod = await prisma.module.findUnique({ where: { id: moduleId }, select: { id: true, title: true, course: { select: { title: true } } } });
  if (!mod) throw new ConsultantError("That module was not found.", 404);
  const { usable, skipped } = await getModuleMaterialsText(moduleId);
  if (usable.length === 0) throw new ConsultantError("This module has no Word-document materials Claude can read. Videos, slides and PDFs cannot be reviewed yet.", 422);
  const snap = await buildSnapshot(30).catch(() => null);
  const stat = snap?.courses.find((c) => c.title === mod.course.title)?.moduleStats.find((m) => m.title === mod.title);
  const performance = stat && stat.hasAssessment && stat.totalAttempts > 0 ? `${stat.totalAttempts} attempts, average ${stat.averagePercentage ?? "n/a"}%, pass rate ${stat.passRate ?? "n/a"}%` : "";
  const label = `${mod.course.title} / ${mod.title}`;
  const msg = await askClaude(client, {
    model: CONSULTANT_MODEL,
    max_tokens: 2500,
    system: MATERIAL_SYSTEM_PROMPT,
    tools: [SUBMIT_MATERIAL_REVIEW_TOOL],
    tool_choice: { type: "tool", name: "submit_material_review" },
    messages: [{ role: "user", content: materialsContext(label, usable, performance) }],
  } satisfies Anthropic.MessageCreateParamsNonStreaming);
  const parsed = MaterialReviewSchema.safeParse(toolInput(msg, "submit_material_review"));
  if (!parsed.success) throw new ConsultantError("Claude's reply could not be read. Nothing was changed. Try again.");
  const clean = cleanMaterialReview(parsed.data, label, skipped.length);
  const row = await store("MATERIAL_REVIEW", clean);
  await logRun(adminId, `Guide consultant: materials review of ${label}`, String(clean.proposal.summary ?? ""));
  return row;
}

/** Asks Claude to draft a guidance note for one AI feature. The note is only a proposal. */
export async function proposeTraining(client: ClaudeClient, adminId: string, feature: string, goal: string) {
  const f = AI_FEATURES.find((x) => x.key === feature);
  if (!f) throw new ConsultantError("That AI feature cannot be trained.", 400);
  const [snap, existing] = await Promise.all([buildSnapshot(30).catch(() => null), currentNote(feature)]);
  const data = snap ? snapshotContext(snap, deriveSignals(snap)) : "(no platform data available)";
  const msg = await askClaude(client, {
    model: CONSULTANT_MODEL,
    max_tokens: 1200,
    system: TRAINING_SYSTEM_PROMPT,
    tools: [SUBMIT_TRAINING_TOOL],
    tool_choice: { type: "tool", name: "submit_training" },
    messages: [{ role: "user", content: `FEATURE: ${f.label}\nWHERE IT IS USED: ${f.where}\nCURRENT APPROVED NOTE: ${existing ?? "(none)"}\n\nGOAL FROM THE SUPER ADMIN\n${goal || "Suggest a modest improvement based on the data."}\n\nPLATFORM DATA\n${data}` }],
  } satisfies Anthropic.MessageCreateParamsNonStreaming);
  const parsed = TrainingSchema.safeParse(toolInput(msg, "submit_training"));
  if (!parsed.success) throw new ConsultantError("Claude's reply could not be read. Nothing was changed. Try again.");
  const clean = cleanTraining(parsed.data, feature);
  if (!clean.ok) throw new ConsultantError(clean.error, 422);
  const row = await store("AI_TRAINING", clean);
  await logRun(adminId, `Guide consultant: guidance proposal for ${f.label}`, clean.proposal.note);
  return row;
}

/** The same gate every consultant button goes through: switch on, key set, at most 10 runs an hour. Returns the refusal to send, or null to go ahead. */
export async function consultantGate(userId: string): Promise<{ error: string; status: number } | null> {
  const { consultantState } = await import("@/lib/guide/consultant");
  const { rateLimit } = await import("@/lib/rateLimit");
  const state = await consultantState();
  if (state.availability === "off") return { error: "The Claude consultant is switched off. Switch it on first.", status: 403 };
  if (state.availability === "not_configured") return { error: "No Anthropic key is set up for this platform (ANTHROPIC_API_KEY), so the consultant cannot run.", status: 503 };
  const limit = await rateLimit(`guide-consultant:${userId}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) return { error: "That is enough for now: the consultant can be asked 10 times an hour.", status: 429 };
  return null;
}

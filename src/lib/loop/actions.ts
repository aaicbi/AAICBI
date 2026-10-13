/**
 * Everything Loop can CHANGE, in one registry. Claude never writes anything
 * itself: it names an action and its inputs, this file validates them and
 * turns them into a plain-words summary, and the engine decides — from the
 * chat's autonomy level and the action's risk — whether to run it now or show
 * the person an approval card first (see policy.ts). Every action, run or
 * proposed, is recorded as a LoopPendingAction.
 *
 * Structural rules that hold whatever the level:
 *  - modules are named in words and resolved to a real id HERE, then stored in
 *    the validated input, so an approved action runs on exactly the module
 *    the card named;
 *  - who a message goes to is never an input Claude supplies: it comes from
 *    the engine's own record of the last resolve_recipients call;
 *  - the trainee to suspend likewise comes from the conversations Loop read;
 *  - nothing here can delete anything.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveModuleByQuery } from "@/lib/loop/moduleLookup";
import { runLoopTool } from "@/lib/loop/tools";
import { BROADCAST_CONFIRM_THRESHOLD, type ActionRisk } from "@/lib/loop/policy";
import { applyQuestSettings, autoSplitPools, QuestAdminError } from "@/lib/quest/admin";
import { sendLoopBroadcast } from "@/lib/messaging/loopBroadcast";
import type { RecipientFilter } from "@/lib/messaging/recipients";
import { issueMessagingSuspension } from "@/lib/messagingModeration";

export class ActionInputError extends Error {}

/** What the engine remembers from this conversation turn's read steps (never shown to Claude). */
export interface EngineState {
  resolvedRecipients: { filter: RecipientFilter; description: string; count: number; truncated: boolean } | null;
  reviewedTrainee: { traineeId: string; traineeName: string } | null;
}

export interface PreparedAction {
  /** Validated, resolved input — exactly what execute() will receive. */
  input: Record<string, unknown>;
  /** Plain-words summary for the card and the audit trail. */
  summary: string;
  risk: ActionRisk;
  alwaysConfirm?: boolean;
}

export interface ActionDef {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required: string[] };
  prepare(raw: Record<string, unknown>, state: EngineState): Promise<PreparedAction>;
  execute(input: Record<string, unknown>, ctx: { userId: string }): Promise<unknown>;
}

async function moduleFrom(raw: Record<string, unknown>) {
  const query = typeof raw.moduleQuery === "string" ? raw.moduleQuery.trim() : "";
  if (!query) throw new ActionInputError("moduleQuery is required: the module's name or part of it.");
  const lookup = await resolveModuleByQuery(query);
  if (!lookup.module) {
    throw new ActionInputError(
      lookup.ambiguousMatches
        ? `More than one module matched. Ask which one was meant: ${lookup.ambiguousMatches.join("; ")}`
        : "No module matched that name."
    );
  }
  return { module: lookup.module, label: `${lookup.module.courseTitle} — ${lookup.module.title}` };
}

const MODULE_PROP = { type: "string", description: "The module's name or a fragment of it (as seen in find_module)." };

// ---------------------------------------------------------------------------

const saveObjectives: ActionDef = {
  name: "save_learning_objectives",
  description:
    "Save learning objectives for a module (what a trainee should be able to do after it). Use after reading the module's materials. Duplicates of existing objectives are skipped.",
  inputSchema: {
    type: "object",
    properties: {
      moduleQuery: MODULE_PROP,
      objectives: { type: "array", items: { type: "string" }, description: "1 to 20 objectives, each one short sentence." },
    },
    required: ["moduleQuery", "objectives"],
  },
  async prepare(raw) {
    const { module, label } = await moduleFrom(raw);
    const list = z.array(z.string().trim().min(1).max(500)).min(1).max(20).safeParse(raw.objectives);
    if (!list.success) throw new ActionInputError("objectives must be 1 to 20 short sentences.");
    return {
      input: { moduleId: module.id, moduleLabel: label, objectives: list.data },
      summary: `Save ${list.data.length} learning objective${list.data.length === 1 ? "" : "s"} for ${label}:\n${list.data.map((o) => `• ${o}`).join("\n")}`,
      risk: "low",
    };
  },
  async execute(input, ctx) {
    const moduleId = String(input.moduleId);
    const wanted = input.objectives as string[];
    const existing = await prisma.moduleLearningObjective.findMany({ where: { moduleId }, select: { text: true, order: true } });
    const have = new Set(existing.map((o) => o.text.trim().toLowerCase()));
    let order = existing.reduce((m, o) => Math.max(m, o.order), -1) + 1;
    const fresh = wanted.filter((t) => !have.has(t.trim().toLowerCase()));
    await prisma.$transaction(
      fresh.map((text) => prisma.moduleLearningObjective.create({ data: { moduleId, text, order: order++, confirmedById: ctx.userId } }))
    );
    return { saved: fresh.length, skippedAsDuplicates: wanted.length - fresh.length };
  },
};

const generateQuestions: ActionDef = {
  name: "generate_bank_questions",
  description:
    "Generate draft exam questions for one CONFIRMED learning objective of a module, grounded in its materials. They stay hidden from trainees until reviewed.",
  inputSchema: {
    type: "object",
    properties: {
      moduleQuery: MODULE_PROP,
      objectiveQuery: { type: "string", description: "The confirmed objective's text or a fragment of it." },
      count: { type: "number", description: "How many questions (capped by the system)." },
    },
    required: ["moduleQuery", "objectiveQuery", "count"],
  },
  async prepare(raw) {
    const { module, label } = await moduleFrom(raw);
    const objectiveQuery = typeof raw.objectiveQuery === "string" ? raw.objectiveQuery.trim() : "";
    if (!objectiveQuery) throw new ActionInputError("objectiveQuery is required.");
    const count = typeof raw.count === "number" && raw.count > 0 ? Math.floor(raw.count) : 10;
    return {
      input: { moduleQuery: module.title, objectiveQuery, count },
      summary: `Draft up to ${count} exam questions for ${label}, testing the objective matching “${objectiveQuery}”. They stay hidden from trainees until reviewed.`,
      risk: "low",
    };
  },
  async execute(input, ctx) {
    return runLoopTool("generate_bank_questions", input, ctx.userId);
  },
};

const validateQuestions: ActionDef = {
  name: "run_bank_validation",
  description:
    "Run independent AI validation on a module's questions that passed the first human review. Clean passes go live; anything flagged waits for the second review.",
  inputSchema: {
    type: "object",
    properties: { moduleQuery: MODULE_PROP, count: { type: "number", description: "How many pending questions (capped by the system)." } },
    required: ["moduleQuery", "count"],
  },
  async prepare(raw) {
    const { module, label } = await moduleFrom(raw);
    const count = typeof raw.count === "number" && raw.count > 0 ? Math.floor(raw.count) : 10;
    return {
      input: { moduleQuery: module.title, count },
      summary: `Validate up to ${count} pending questions for ${label}. A clean pass goes live in the question bank; anything flagged waits for your second review.`,
      risk: "low",
    };
  },
  async execute(input, ctx) {
    return runLoopTool("run_bank_validation", input, ctx.userId);
  },
};

const splitPools: ActionDef = {
  name: "split_question_pools",
  description: "Split a module's approved questions that have no pool yet between the practice pool and the formal-assessment pool (about 40% formal).",
  inputSchema: { type: "object", properties: { moduleQuery: MODULE_PROP }, required: ["moduleQuery"] },
  async prepare(raw) {
    const { module, label } = await moduleFrom(raw);
    return {
      input: { moduleId: module.id, moduleLabel: label },
      summary: `Split the approved questions of ${label} between the practice pool and the formal pool (about 40% formal). Questions already assigned stay as they are.`,
      risk: "low",
    };
  },
  async execute(input) {
    return autoSplitPools(String(input.moduleId));
  },
};

const practiceSettings: ActionDef = {
  name: "set_practice_settings",
  description:
    "Change a module's practice settings: switch practice on or off (only possible once every objective has 10 practice and 6 formal approved questions), require practice before the assessment, set the required percentage, choose which rewards are on, and choose which objectives are required to pass the assessment.",
  inputSchema: {
    type: "object",
    properties: {
      moduleQuery: MODULE_PROP,
      practiceEnabled: { type: "boolean" },
      practiceBeforeFormal: { type: "boolean" },
      practiceRequiredPercent: { type: "number", description: "10 to 100" },
      enabledRewards: { type: "array", items: { type: "string", enum: ["ANSWER", "MISSED_BONUS", "STREAK", "OBJECTIVE_MASTERED", "MODULE_COMPLETED"] } },
      requiredObjectiveQueries: { type: "array", items: { type: "string" }, description: "Text fragments of the objectives trainees must clear to pass the assessment. An empty list clears all." },
    },
    required: ["moduleQuery"],
  },
  async prepare(raw) {
    const { module, label } = await moduleFrom(raw);
    const input: Record<string, unknown> = { moduleId: module.id, moduleLabel: label };
    const parts: string[] = [];
    if (typeof raw.practiceEnabled === "boolean") {
      input.practiceEnabled = raw.practiceEnabled;
      parts.push(raw.practiceEnabled ? "switch practice on" : "switch practice off");
    }
    if (typeof raw.practiceBeforeFormal === "boolean") {
      input.practiceBeforeFormal = raw.practiceBeforeFormal;
      parts.push(raw.practiceBeforeFormal ? "require practice before the assessment" : "stop requiring practice before the assessment");
    }
    if (typeof raw.practiceRequiredPercent === "number") {
      const pct = Math.max(10, Math.min(100, Math.round(raw.practiceRequiredPercent)));
      input.practiceRequiredPercent = pct;
      parts.push(`require ${pct}% of objectives mastered first`);
    }
    if (Array.isArray(raw.enabledRewards)) {
      input.enabledRewards = raw.enabledRewards.filter((x): x is string => typeof x === "string");
      parts.push(`rewards on: ${(input.enabledRewards as string[]).join(", ") || "none"}`);
    }
    if (Array.isArray(raw.requiredObjectiveQueries)) {
      const objectives = await prisma.moduleLearningObjective.findMany({ where: { moduleId: module.id }, select: { id: true, text: true } });
      const queries = raw.requiredObjectiveQueries.filter((x): x is string => typeof x === "string" && x.trim() !== "");
      const chosen = objectives.filter((o) => queries.some((q) => o.text.toLowerCase().includes(q.toLowerCase())));
      input.criticalObjectiveIds = chosen.map((o) => o.id);
      parts.push(chosen.length ? `required objectives: ${chosen.map((o) => `“${o.text}”`).join(", ")}` : "no required objectives");
    }
    if (parts.length === 0) throw new ActionInputError("Nothing to change: give at least one setting.");
    return { input, summary: `For ${label}: ${parts.join("; ")}.`, risk: "low" };
  },
  async execute(input) {
    try {
      await applyQuestSettings(String(input.moduleId), {
        practiceEnabled: input.practiceEnabled as boolean | undefined,
        practiceBeforeFormal: input.practiceBeforeFormal as boolean | undefined,
        practiceRequiredPercent: input.practiceRequiredPercent as number | undefined,
        enabledRewards: input.enabledRewards as string[] | undefined,
        criticalObjectiveIds: input.criticalObjectiveIds as string[] | undefined,
      });
    } catch (e) {
      if (e instanceof QuestAdminError) throw new Error(e.message);
      throw e;
    }
    return { updated: true };
  },
};

const sendMessage: ActionDef = {
  name: "send_message",
  description:
    "Send a message to the people found by your LAST resolve_recipients call. You cannot choose or change the recipients here: they are exactly who resolve_recipients returned. Write the message in a warm, clear voice.",
  inputSchema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      category: { type: "string", description: "e.g. ANNOUNCEMENT, REMINDER, UPDATE" },
    },
    required: ["subject", "body"],
  },
  async prepare(raw, state) {
    if (!state.resolvedRecipients) throw new ActionInputError("Call resolve_recipients first, so the recipient count is accurate.");
    const subject = typeof raw.subject === "string" ? raw.subject.trim().slice(0, 200) : "";
    const body = typeof raw.body === "string" ? raw.body.trim().slice(0, 5000) : "";
    if (!subject || !body) throw new ActionInputError("subject and body are required.");
    const r = state.resolvedRecipients;
    const category = typeof raw.category === "string" && raw.category.trim() ? raw.category.trim().slice(0, 60) : "ANNOUNCEMENT";
    return {
      input: { recipientFilter: r.filter, recipientDescription: r.description, recipientCountExpected: r.count, subject, body, category },
      summary: `Send to ${r.count} recipient${r.count === 1 ? "" : "s"} (${r.description}${r.truncated ? ", list capped" : ""}).\nSubject: ${subject}\n\n${body}`,
      risk: "high",
      alwaysConfirm: r.count > BROADCAST_CONFIRM_THRESHOLD,
    };
  },
  async execute(input, ctx) {
    return sendLoopBroadcast({
      authorizedById: ctx.userId,
      recipientFilter: input.recipientFilter as RecipientFilter,
      recipientDescription: String(input.recipientDescription),
      recipientCountExpected: Number(input.recipientCountExpected),
      subject: String(input.subject),
      body: String(input.body),
      category: String(input.category),
    });
  },
};

const suspendMessaging: ActionDef = {
  name: "suspend_messaging",
  description:
    "Suspend the messaging access of the trainee whose conversations you just read with get_conversation_messages. Only when what you read genuinely warrants it. You cannot choose a different trainee.",
  inputSchema: { type: "object", properties: { reason: { type: "string", description: "Why, grounded in what the messages showed." } }, required: ["reason"] },
  async prepare(raw, state) {
    if (!state.reviewedTrainee) throw new ActionInputError("Read the trainee's conversations with get_conversation_messages first.");
    const reason = typeof raw.reason === "string" ? raw.reason.trim().slice(0, 1000) : "";
    if (!reason) throw new ActionInputError("A reason is required.");
    return {
      input: { traineeId: state.reviewedTrainee.traineeId, traineeName: state.reviewedTrainee.traineeName, reason },
      summary: `Suspend ${state.reviewedTrainee.traineeName}'s messaging access.\nReason: ${reason}`,
      risk: "high",
    };
  },
  async execute(input, ctx) {
    const result = await issueMessagingSuspension(String(input.traineeId), ctx.userId, String(input.reason));
    return { suspended: true, alreadySuspended: !result.changed };
  },
};

export const LOOP_ACTIONS: ActionDef[] = [saveObjectives, generateQuestions, validateQuestions, splitPools, practiceSettings, sendMessage, suspendMessaging];

export const LOOP_ACTION_BY_NAME = new Map(LOOP_ACTIONS.map((a) => [a.name, a]));

/** Action names the generic read dispatcher must not run by itself (they only run through the action path). */
export const ACTION_TOOL_NAMES = new Set(LOOP_ACTIONS.map((a) => a.name));

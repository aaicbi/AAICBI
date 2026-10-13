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
import { FORMAT_INFO, isItemFormat, validateItemContent, type ItemFormat } from "@/lib/quest/games";
import { gamesWhere } from "@/lib/quest/studioAccess";
import { resolveModuleForScope } from "@/lib/loop/scope";
import { StudioError, approveDrafts, assignGame, createGame, createItem, isGameFormat, updateGame } from "@/lib/quest/studio";

export class ActionInputError extends Error {}

/** What the engine remembers from this conversation turn's read steps (never shown to Claude). */
export interface EngineState {
  /** Who is asking. Organization staff and instructors are limited to their own modules and games. */
  scope: { userId: string; role: string; isSuper: boolean };
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

async function moduleFrom(raw: Record<string, unknown>, state: EngineState) {
  const query = typeof raw.moduleQuery === "string" ? raw.moduleQuery.trim() : "";
  if (!query) throw new ActionInputError("moduleQuery is required: the module's name or part of it.");
  const lookup = await resolveModuleForScope(query, state.scope);
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
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
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
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
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
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
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
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
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
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
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


// ---------------------------------------------------------------------------
// Game Studio actions
// ---------------------------------------------------------------------------

async function gameFrom(raw: Record<string, unknown>, state: EngineState) {
  const query = typeof raw.gameQuery === "string" ? raw.gameQuery.trim() : "";
  if (!query) throw new ActionInputError("gameQuery is required: the game's name or part of it (see list_games).");
  const games = await prisma.game.findMany({ where: { title: { contains: query, mode: "insensitive" }, ...gamesWhere(state.scope) }, select: { id: true, title: true, format: true }, take: 10 });
  if (games.length === 0) throw new ActionInputError("No game matched that name. Use list_games to see them, or create_game first.");
  if (games.length > 1) throw new ActionInputError(`More than one game matched. Ask which one was meant: ${games.map((g) => g.title).join("; ")}`);
  return games[0];
}

const GAME_PROP = { type: "string", description: "The game's name or a fragment of it (see list_games)." };
const FORMAT_ENUM = { type: "string", enum: ["QUIZ", "MATCHING", "ORDERING", "SCENARIO"] };

const createGameAction: ActionDef = {
  name: "create_game",
  description: "Create a game in the studio library. Formats: QUIZ (practice from the approved question bank), MATCHING (match terms to meanings), ORDERING (put steps in order), SCENARIO (pick an action and see the outcome).",
  inputSchema: {
    type: "object",
    properties: { title: { type: "string" }, format: FORMAT_ENUM, description: { type: "string", description: "One sentence on what trainees do." } },
    required: ["title", "format"],
  },
  async prepare(raw, state) {
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!title) throw new ActionInputError("A title is required.");
    if (!isGameFormat(raw.format)) throw new ActionInputError("format must be QUIZ, MATCHING, ORDERING or SCENARIO.");
    const description = typeof raw.description === "string" ? raw.description.trim() : null;
    return { input: { title, format: raw.format, description }, summary: `Create the ${FORMAT_INFO[raw.format].label} game “${title}” in the studio library.`, risk: "low" };
  },
  async execute(input, ctx) {
    const game = await createGame(ctx.userId, { title: String(input.title), format: input.format as never, description: (input.description as string | null) ?? null });
    return { gameId: game.id, title: game.title };
  },
};

const setGameRewards: ActionDef = {
  name: "set_game_rewards",
  description: "Choose which rewards a game pays: ANSWER (XP for a correct answer), MISSED_BONUS, STREAK, OBJECTIVE_MASTERED, MODULE_COMPLETED.",
  inputSchema: {
    type: "object",
    properties: { gameQuery: GAME_PROP, enabledRewards: { type: "array", items: { type: "string", enum: ["ANSWER", "MISSED_BONUS", "STREAK", "OBJECTIVE_MASTERED", "MODULE_COMPLETED"] } } },
    required: ["gameQuery", "enabledRewards"],
  },
  async prepare(raw, state) {
    const game = await gameFrom(raw, state);
    const rewards = Array.isArray(raw.enabledRewards) ? raw.enabledRewards.filter((x): x is string => typeof x === "string") : [];
    return { input: { gameId: game.id, gameTitle: game.title, enabledRewards: rewards }, summary: `Set the rewards for “${game.title}” to: ${rewards.join(", ") || "none"}.`, risk: "low" };
  },
  async execute(input) {
    await updateGame(String(input.gameId), { enabledRewards: input.enabledRewards as string[] });
    return { updated: true };
  },
};

const assignGameAction: ActionDef = {
  name: "assign_game",
  description:
    "Assign a game to a module, and optionally make it live so trainees can play it, or remove it. Making a QUIZ game live needs every objective to have 10 approved practice and 6 approved formal questions. Making another format live needs at least one APPROVED item for that module.",
  inputSchema: {
    type: "object",
    properties: { gameQuery: GAME_PROP, moduleQuery: MODULE_PROP, assigned: { type: "boolean", description: "false removes it from the module. Default true." }, live: { type: "boolean", description: "true makes it playable by trainees, false hides it." } },
    required: ["gameQuery", "moduleQuery"],
  },
  async prepare(raw, state) {
    const game = await gameFrom(raw, state);
    const { module, label } = await moduleFrom(raw, state);
    const assigned = raw.assigned !== false;
    const live = typeof raw.live === "boolean" ? raw.live : undefined;
    const what = !assigned ? `Remove “${game.title}” from ${label}` : live === true ? `Assign “${game.title}” to ${label} and make it live for trainees` : live === false ? `Assign “${game.title}” to ${label}, hidden from trainees` : `Assign “${game.title}” to ${label}`;
    // Putting something in front of trainees is the risky part.
    return { input: { gameId: game.id, moduleId: module.id, assigned, live }, summary: `${what}.`, risk: live === true ? "high" : "low" };
  },
  async execute(input) {
    try {
      await assignGame(String(input.gameId), String(input.moduleId), { assigned: input.assigned !== false, live: input.live as boolean | undefined });
    } catch (e) {
      if (e instanceof StudioError) throw new Error(e.message);
      throw e;
    }
    return { done: true };
  },
};

const addGameItems: ActionDef = {
  name: "add_game_items",
  description:
    "Write playable items for a module's game format, as DRAFTS that stay hidden until a person approves them. Base them on the module's real materials (read_module_materials) and one confirmed learning objective. Shapes: MATCHING {prompt, pairs:[{left,right}] 3-6, all different}; ORDERING {prompt, steps:[strings in the CORRECT order] 3-8}; SCENARIO {situation, options:[{text, outcome, correct}] 2-4, exactly one correct, each with what happens if chosen}. Write 3 to 8 items per call.",
  inputSchema: {
    type: "object",
    properties: {
      moduleQuery: MODULE_PROP,
      objectiveQuery: { type: "string", description: "The confirmed objective's text or a fragment of it." },
      format: { type: "string", enum: ["MATCHING", "ORDERING", "SCENARIO"] },
      items: { type: "array", items: { type: "object" }, description: "1 to 10 items in the shape for the format." },
    },
    required: ["moduleQuery", "objectiveQuery", "format", "items"],
  },
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
    if (typeof raw.format !== "string" || !isItemFormat(raw.format)) throw new ActionInputError("format must be MATCHING, ORDERING or SCENARIO.");
    const format: ItemFormat = raw.format;
    const q = typeof raw.objectiveQuery === "string" ? raw.objectiveQuery.trim().toLowerCase() : "";
    const objectives = await prisma.moduleLearningObjective.findMany({ where: { moduleId: module.id }, select: { id: true, text: true } });
    if (objectives.length === 0) throw new ActionInputError("This module has no confirmed learning objectives yet. Save them first (save_learning_objectives).");
    const matches = q ? objectives.filter((o) => o.text.toLowerCase().includes(q)) : [];
    if (matches.length === 0) throw new ActionInputError(`No objective matched. The module's objectives are: ${objectives.map((o) => `“${o.text}”`).join("; ")}`);
    if (matches.length > 1) throw new ActionInputError(`More than one objective matched. Ask which one: ${matches.map((o) => o.text).join("; ")}`);
    const list = Array.isArray(raw.items) ? raw.items.slice(0, 10) : [];
    if (list.length === 0) throw new ActionInputError("items must have at least one item.");
    const valid: unknown[] = [];
    const problems: string[] = [];
    list.forEach((item, i) => {
      const v = validateItemContent(format, item);
      if (v.ok) valid.push(v.content);
      else problems.push(`Item ${i + 1}: ${v.error}`);
    });
    if (valid.length === 0) throw new ActionInputError(`None of the items were valid. ${problems.join(" ")}`);
    const noun = FORMAT_INFO[format].itemNoun;
    return {
      input: { moduleId: module.id, objectiveId: matches[0].id, format, items: valid },
      summary: `Add ${valid.length} ${noun}${valid.length === 1 ? "" : "s"} to ${label} for the objective “${matches[0].text}”. They are saved as drafts that trainees cannot see until you approve them.${problems.length ? `\n(${problems.length} item${problems.length === 1 ? " was" : "s were"} left out: ${problems.join(" ")})` : ""}`,
      risk: "low",
    };
  },
  async execute(input) {
    let added = 0;
    for (const content of input.items as unknown[]) {
      await createItem(String(input.moduleId), { objectiveId: String(input.objectiveId), format: String(input.format), content, source: "LOOP", status: "DRAFT" });
      added++;
    }
    return { added };
  },
};

const approveGameItems: ActionDef = {
  name: "approve_game_items",
  description:
    "Approve every DRAFT item of one format in a module so trainees can play them. This is the human review step: it is ALWAYS shown to the admin for approval, whatever the chat's level, and you should encourage them to try the preview first.",
  inputSchema: { type: "object", properties: { moduleQuery: MODULE_PROP, format: { type: "string", enum: ["MATCHING", "ORDERING", "SCENARIO"] } }, required: ["moduleQuery", "format"] },
  async prepare(raw, state) {
    const { module, label } = await moduleFrom(raw, state);
    if (typeof raw.format !== "string" || !isItemFormat(raw.format)) throw new ActionInputError("format must be MATCHING, ORDERING or SCENARIO.");
    const drafts = await prisma.gameItem.count({ where: { moduleId: module.id, format: raw.format, status: "DRAFT" } });
    if (drafts === 0) throw new ActionInputError("There are no drafts of that format to approve in this module.");
    return {
      input: { moduleId: module.id, format: raw.format },
      summary: `Approve ${drafts} draft ${FORMAT_INFO[raw.format].itemNoun}${drafts === 1 ? "" : "s"} in ${label}, so trainees can play them once the game is live. Try the preview first if you have not.`,
      risk: "high",
      alwaysConfirm: true,
    };
  },
  async execute(input, ctx) {
    const approved = await approveDrafts(String(input.moduleId), input.format as ItemFormat, ctx.userId);
    return { approved };
  },
};

export const LOOP_ACTIONS: ActionDef[] = [
  saveObjectives,
  generateQuestions,
  validateQuestions,
  splitPools,
  practiceSettings,
  createGameAction,
  setGameRewards,
  assignGameAction,
  addGameItems,
  approveGameItems,
  sendMessage,
  suspendMessaging,
];

export const LOOP_ACTION_BY_NAME = new Map(LOOP_ACTIONS.map((a) => [a.name, a]));

/** Action names the generic read dispatcher must not run by itself (they only run through the action path). */
export const ACTION_TOOL_NAMES = new Set(LOOP_ACTIONS.map((a) => a.name));

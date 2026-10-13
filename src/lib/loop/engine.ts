/**
 * The Command Center's conversation engine. One call = one turn of one chat:
 * stream Claude's answer, let it read real platform data and documents through
 * tools, and handle every change through the action registry so the chat's
 * autonomy level (policy.ts) decides whether it runs now or waits for approval.
 *
 * Claude's own capacity is not narrowed here: it can discuss, analyse, draft
 * and plan anything. What it can DO is exactly the tools and actions below.
 */
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { LOOP_TOOL_SCHEMAS, runLoopTool, buildRecipientFilterFromToolInput } from "@/lib/loop/tools";
import { resolveRecipients } from "@/lib/messaging/recipients";
import { resolveModuleByQuery } from "@/lib/loop/moduleLookup";
import { getModuleMaterialsText } from "@/lib/parsing/moduleMaterialsText";
import { getTraineeConversationMessagesForReview } from "@/lib/messaging";
import { withGuidance } from "@/lib/guide/aiGuidance";
import { ActionInputError, LOOP_ACTIONS, LOOP_ACTION_BY_NAME, type EngineState } from "@/lib/loop/actions";
import { LOOP_LEVELS, decideExecution, type LoopLevel } from "@/lib/loop/policy";
import { executeLoopAction, type ActionCard } from "@/lib/loop/runAction";

export const LOOP_MODEL = process.env.LOOP_MODEL || "claude-sonnet-4-5";
const MAX_ROUNDS = 12;
const MAX_TOOL_RESULT_CHARS = 40_000;

export type LoopEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; label: string; state: "running" | "done" }
  | { type: "action"; card: ActionCard }
  | { type: "done"; text: string; toolEvents: { tool: string; label: string }[]; actions: ActionCard[] }
  | { type: "error"; message: string };

export interface TurnAttachment {
  name: string;
  kind: string;
  /** Extracted text (documents) — replayed to Claude on later turns. */
  text?: string;
  truncated?: boolean;
  /** Pictures are shown to Claude for this turn only. */
  image?: { mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; base64: string };
}

function systemPrompt(level: LoopLevel): string {
  const lv = LOOP_LEVELS.find((l) => l.level === level)!;
  return `You are Loop, the AI executive assistant to the Super Admin of the AAICBI Ecosystem (a platform where trainees learn, training organizations run courses, and employers and investors find talent).

You are a full-capability assistant. Think, analyse, write, explain, plan and advise on anything the admin asks, as freely and thoroughly as Claude would. You also have tools to read real platform data and documents, and actions to change things.

How you work:
- Ground every number or claim about the platform in data you actually retrieved with a tool this conversation. Never state a figure you did not look up. Say plainly when you could not find something.
- Never ask the admin for ids. Modules, courses and people are found by name with find_module and search_people.
- Documents: read_module_materials reads a module's Word, PDF and PowerPoint files. Videos cannot be read (there is no transcript), so say so and ask for a transcript or notes. Files the admin attaches to the chat are included in the conversation for you.
- Changes happen only through your action tools. This chat's autonomy level is ${level} (${lv.name}): ${lv.description} After calling an action, read its result: if it says it is awaiting approval, tell the admin you have prepared it and it is waiting for their approval, and never say it is done. If it says it ran, report the real result. Never claim a change you did not make.
- To message people: search_people if a person is named, call resolve_recipients to find who and how many, then send_message. You cannot choose recipients in send_message; they are exactly who resolve_recipients returned. If the match is ambiguous or empty, ask a clarifying question instead.
- To set up learning objectives for a module: find_module, then read_module_materials, then write good objectives yourself from what you read and call save_learning_objectives. Then, if asked, generate_bank_questions for one objective at a time.
- To review a trainee's messages for abuse, call get_conversation_messages. Only if what you read genuinely warrants it, call suspend_messaging. If nothing warrants it, say so.
- When describing a change in analytics, say what changed, not why. A behavioural association is not proof of cause.
- You can only do what your tools allow. If the admin asks for something no tool covers, say so plainly and suggest how they can do it themselves.
- Write in clear Markdown: short paragraphs, lists, tables and code blocks where they help. Be concise; do not pad.`;
}

const FIND_MODULE_TOOL = {
  name: "find_module",
  description: "Find modules by name (or part of it). Returns each match with its course, how many learning objectives it has, how many materials, and its question counts. Use this first for anything about a module.",
  input_schema: { type: "object" as const, properties: { query: { type: "string", description: "The module's name or a fragment, e.g. 'AIAF-Module 1'." } }, required: ["query"] },
};

const GET_MODULE_DETAILS_TOOL = {
  name: "get_module_details",
  description: "Everything about one module: its lessons and materials, confirmed learning objectives, question counts by pool and status, practice settings and assessment settings.",
  input_schema: { type: "object" as const, properties: { moduleQuery: { type: "string" } }, required: ["moduleQuery"] },
};

const READ_MODULE_MATERIALS_TOOL = {
  name: "read_module_materials",
  description: "Read the full text of a module's lesson materials (Word, PDF and PowerPoint files). Videos cannot be read; they are listed as skipped with the reason.",
  input_schema: { type: "object" as const, properties: { moduleQuery: { type: "string" } }, required: ["moduleQuery"] },
};

/** Tools handled by the engine itself. */
const ENGINE_TOOLS = [FIND_MODULE_TOOL, GET_MODULE_DETAILS_TOOL, READ_MODULE_MATERIALS_TOOL];
/** Old tools replaced by actions or by the engine's own reading tools. */
const REPLACED = new Set(["analyze_module_materials", "generate_bank_questions", "run_bank_validation"]);

function buildTools(): Anthropic.Tool[] {
  const reads = (LOOP_TOOL_SCHEMAS as Anthropic.Tool[]).filter((t) => !REPLACED.has(t.name));
  const actions = LOOP_ACTIONS.map((a) => ({ name: a.name, description: a.description, input_schema: a.inputSchema })) as Anthropic.Tool[];
  return [...reads, ...(ENGINE_TOOLS as Anthropic.Tool[]), ...actions];
}

const TOOL_LABELS: Record<string, string> = {
  search_people: "Searching people",
  get_trainee_report: "Reading a trainee report",
  get_employer_report: "Reading an employer report",
  list_cohorts: "Listing cohorts",
  get_cohort_report: "Reading a cohort report",
  get_staff_report: "Reading a staff report",
  get_platform_overview: "Reading the platform overview",
  get_analytics_overview: "Reading analytics",
  get_analytics_content_performance: "Reading content performance",
  get_analytics_interest_and_segments: "Reading interests and segments",
  get_analytics_search_demand: "Reading search demand",
  get_analytics_cohorts: "Reading cohort analytics",
  get_analytics_insights: "Reading analytics insights",
  get_module_assessment_stats: "Reading assessment results",
  get_conversation_messages: "Reading a trainee's conversations",
  resolve_recipients: "Working out who this reaches",
  find_module: "Finding the module",
  get_module_details: "Reading the module's details",
  read_module_materials: "Reading the module's materials",
};
export const toolLabel = (name: string) => TOOL_LABELS[name] ?? LOOP_ACTION_BY_NAME.get(name)?.name.replace(/_/g, " ") ?? name.replace(/_/g, " ");

function cap(text: string): string {
  return text.length <= MAX_TOOL_RESULT_CHARS ? text : `${text.slice(0, MAX_TOOL_RESULT_CHARS)}\n[… cut: result longer than ${MAX_TOOL_RESULT_CHARS.toLocaleString()} characters]`;
}

async function findModule(query: string) {
  const modules = await prisma.module.findMany({
    where: { title: { contains: query, mode: "insensitive" } },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      course: { select: { title: true } },
      _count: { select: { learningObjectives: true, lessons: true } },
      assessment: { select: { published: true, _count: { select: { questions: true } } } },
    },
  });
  return {
    matches: modules.map((m) => ({
      module: `${m.course.title} — ${m.title}`,
      lessons: m._count.lessons,
      learningObjectives: m._count.learningObjectives,
      assessmentQuestions: m.assessment?._count.questions ?? 0,
      assessmentPublished: m.assessment?.published ?? false,
    })),
  };
}

async function moduleDetails(query: string) {
  const lookup = await resolveModuleByQuery(query);
  if (!lookup.module) return { found: false, ambiguousMatches: lookup.ambiguousMatches };
  const id = lookup.module.id;
  const [mod, objectives, byStatus, byPool, settings] = await Promise.all([
    prisma.module.findUnique({
      where: { id },
      select: {
        lessons: { orderBy: { order: "asc" }, select: { title: true, materials: { orderBy: { order: "asc" }, select: { title: true, type: true } } } },
        assessment: { select: { published: true, passMarkPercent: true, durationMinutes: true, numQuestions: true, maxAttempts: true } },
      },
    }),
    prisma.moduleLearningObjective.findMany({ where: { moduleId: id }, orderBy: { order: "asc" }, select: { text: true, isCritical: true } }),
    prisma.question.groupBy({ by: ["bankStatus"], where: { exam: { moduleId: id } }, _count: { _all: true } }),
    prisma.question.groupBy({ by: ["bankPool"], where: { exam: { moduleId: id }, bankStatus: "APPROVED" }, _count: { _all: true } }),
    prisma.moduleQuestSettings.findUnique({ where: { moduleId: id } }),
  ]);
  return {
    found: true,
    module: `${lookup.module.courseTitle} — ${lookup.module.title}`,
    lessons: mod?.lessons,
    learningObjectives: objectives,
    questionsByStatus: byStatus.map((g) => ({ status: g.bankStatus ?? "legacy/unreviewed", count: g._count._all })),
    approvedQuestionsByPool: byPool.map((g) => ({ pool: g.bankPool ?? "not assigned", count: g._count._all })),
    practiceSettings: settings ?? "not set up",
    assessment: mod?.assessment ?? "none",
  };
}

async function readMaterials(query: string) {
  const lookup = await resolveModuleByQuery(query);
  if (!lookup.module) return { found: false, ambiguousMatches: lookup.ambiguousMatches };
  const m = await getModuleMaterialsText(lookup.module.id);
  return {
    found: true,
    module: `${lookup.module.courseTitle} — ${lookup.module.title}`,
    readable: m.usable.map((u) => ({ title: u.title, text: u.text.length > 25_000 ? `${u.text.slice(0, 25_000)}\n[… cut]` : u.text })),
    skipped: m.skipped.map((s) => ({ title: s.title, reason: s.reason })),
  };
}

/** Replays a saved conversation to Claude. Earlier attachments come back as text; actions' outcomes are noted. */
export async function buildHistory(conversationId: string): Promise<Anthropic.MessageParam[]> {
  const rows = await prisma.loopMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: { actions: { select: { kind: true, summary: true, status: true, autoExecuted: true } } },
  });
  const out: Anthropic.MessageParam[] = [];
  for (const r of rows) {
    if (r.role === "user") {
      out.push({ role: "user", content: r.context ? `${r.text}\n\n${r.context}` : r.text });
    } else {
      const notes = r.actions.map((a) => {
        const what = a.summary.split("\n")[0];
        const state = a.status === "EXECUTED" ? (a.autoExecuted ? "was done" : "was approved and done") : a.status === "REJECTED" ? "was declined" : a.status === "FAILED" ? "failed" : "is waiting for approval";
        return `[Action ${a.kind}: ${what} — ${state}]`;
      });
      const text = [r.text, ...notes].filter(Boolean).join("\n\n");
      if (text) out.push({ role: "assistant", content: text });
    }
  }
  // The API needs the first message to be from the user and roles to alternate.
  const merged: Anthropic.MessageParam[] = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role && typeof last.content === "string" && typeof m.content === "string") last.content = `${last.content}\n\n${m.content}`;
    else merged.push({ ...m });
  }
  while (merged.length && merged[0].role !== "user") merged.shift();
  return merged;
}

export function userContent(text: string, attachments: TurnAttachment[]): Anthropic.MessageParam["content"] {
  const blocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
  for (const a of attachments) {
    if (a.image) blocks.push({ type: "image", source: { type: "base64", media_type: a.image.mediaType, data: a.image.base64 } });
  }
  const docs = attachments.filter((a) => a.text).map((a) => `Attached file “${a.name}” (${a.kind}${a.truncated ? ", cut because it is long" : ""}):\n${a.text}`);
  const pics = attachments.filter((a) => a.image).map((a) => `[A picture named “${a.name}” is attached.]`);
  blocks.push({ type: "text", text: [text, ...pics, ...docs].filter(Boolean).join("\n\n") });
  return blocks;
}

/** The text stored on the message so later turns can replay attachments without the pictures. */
export function attachmentContext(attachments: TurnAttachment[]): string | null {
  const parts = attachments.map((a) =>
    a.text ? `Attached file “${a.name}” (${a.kind}${a.truncated ? ", cut because it is long" : ""}):\n${a.text}` : `[A picture named “${a.name}” was attached earlier in this chat.]`
  );
  return parts.length ? parts.join("\n\n") : null;
}

export async function* runLoopTurn(opts: {
  userId: string;
  conversationId: string;
  messageId: string;
  level: LoopLevel;
  history: Anthropic.MessageParam[];
  signal?: AbortSignal;
  client?: Anthropic;
}): AsyncGenerator<LoopEvent> {
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120_000 });
  const tools = buildTools();
  const system = await withGuidance(systemPrompt(opts.level), "command-loop");
  const state: EngineState = { resolvedRecipients: null, reviewedTrainee: null };
  let messages = opts.history;
  let fullText = "";
  const toolEvents: { tool: string; label: string }[] = [];
  const cards: ActionCard[] = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let finalMessage: Anthropic.Message;
    try {
      const stream = client.messages.stream({ model: LOOP_MODEL, max_tokens: 4096, system, tools, messages }, { signal: opts.signal });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          fullText += event.delta.text;
          yield { type: "text", delta: event.delta.text };
        }
      }
      finalMessage = await stream.finalMessage();
    } catch (e) {
      if (opts.signal?.aborted) {
        yield { type: "done", text: fullText, toolEvents, actions: cards };
        return;
      }
      console.error("Loop: Anthropic call failed:", e);
      yield { type: "error", message: "Loop couldn't reach the AI service just now. Please try again." };
      return;
    }

    messages = [...messages, { role: "assistant", content: finalMessage.content }];
    if (finalMessage.stop_reason !== "tool_use") break;

    const toolUses = finalMessage.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      const label = toolLabel(block.name);
      yield { type: "tool", id: block.id, label, state: "running" };
      const input = (block.input ?? {}) as Record<string, unknown>;
      let content: unknown;
      let isError = false;
      try {
        const action = LOOP_ACTION_BY_NAME.get(block.name);
        if (action) {
          const prepared = await action.prepare(input, state);
          const decision = decideExecution({ level: opts.level, risk: prepared.risk, alwaysConfirm: prepared.alwaysConfirm });
          const row = await prisma.loopPendingAction.create({
            data: {
              conversationId: opts.conversationId,
              messageId: opts.messageId,
              userId: opts.userId,
              kind: action.name,
              summary: prepared.summary,
              risk: prepared.risk,
              input: prepared.input as object,
            },
          });
          if (decision === "run") {
            const card = await executeLoopAction(row.id, opts.userId, { auto: true });
            cards.push(card);
            yield { type: "action", card };
            content = card.status === "EXECUTED" ? { done: true, result: card.result } : { done: false, failed: true, error: card.error };
            isError = card.status !== "EXECUTED";
          } else {
            const card: ActionCard = { id: row.id, kind: action.name, summary: prepared.summary, risk: prepared.risk, status: "PENDING", autoExecuted: false };
            cards.push(card);
            yield { type: "action", card };
            content = { awaitingApproval: true, note: "The admin will see an approval card. It has NOT been done yet. Do not say it is done." };
          }
        } else if (block.name === "find_module") {
          content = await findModule(String(input.query ?? ""));
        } else if (block.name === "get_module_details") {
          content = await moduleDetails(String(input.moduleQuery ?? ""));
        } else if (block.name === "read_module_materials") {
          content = await readMaterials(String(input.moduleQuery ?? ""));
        } else if (block.name === "resolve_recipients") {
          const filter = buildRecipientFilterFromToolInput(input);
          const description = typeof input.description === "string" ? input.description : "the selected recipients";
          const result = await resolveRecipients(filter);
          state.resolvedRecipients = { filter, description, count: result.recipients.length, truncated: result.truncated };
          content = {
            recipientCount: result.recipients.length,
            previewNames: result.recipients.slice(0, 10).map((r) => r.name),
            truncated: result.truncated,
            ambiguousMatches: result.ambiguousMatches,
          };
        } else if (block.name === "get_conversation_messages") {
          const traineeId = typeof input.traineeId === "string" ? input.traineeId : "";
          const trainee = await prisma.trainee.findUnique({ where: { id: traineeId }, select: { id: true, name: true } });
          if (!trainee) {
            content = { found: false, error: "No trainee found with that id." };
          } else {
            const chat = await getTraineeConversationMessagesForReview(trainee.id);
            state.reviewedTrainee = { traineeId: trainee.id, traineeName: trainee.name };
            content = { found: true, trainee: trainee.name, messageCount: chat.length, messages: chat };
          }
        } else if (REPLACED.has(block.name)) {
          content = { error: "That tool was replaced. Use the module tools and actions instead." };
          isError = true;
        } else {
          content = await runLoopTool(block.name, input, opts.userId);
        }
      } catch (e) {
        isError = true;
        content = { error: e instanceof ActionInputError ? e.message : "That step failed. Try a different approach or tell the admin plainly." };
        if (!(e instanceof ActionInputError)) console.error(`Loop tool ${block.name} failed:`, e);
      }
      toolEvents.push({ tool: block.name, label });
      yield { type: "tool", id: block.id, label, state: "done" };
      results.push({ type: "tool_result", tool_use_id: block.id, content: cap(JSON.stringify(content)), ...(isError ? { is_error: true } : {}) });
    }
    messages = [...messages, { role: "user", content: results }];

    if (round === MAX_ROUNDS - 1) {
      const note = "\n\n(I reached the limit of steps for one reply. Ask me to continue and I will pick up from here.)";
      fullText += note;
      yield { type: "text", delta: note };
    }
  }

  yield { type: "done", text: fullText, toolEvents, actions: cards };
}

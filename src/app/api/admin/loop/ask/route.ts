import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { LOOP_TOOL_SCHEMAS, runLoopTool, buildRecipientFilterFromToolInput } from "@/lib/loop/tools";
import { resolveRecipients, type RecipientFilter } from "@/lib/messaging/recipients";
import { resolveModuleByQuery } from "@/lib/loop/moduleLookup";
import { getModuleMaterialsText } from "@/lib/parsing/moduleMaterialsText";
import { draftLearningObjectives } from "@/lib/ai/generateLearningObjectives";

/**
 * POST /api/admin/loop/ask — the AI Command Center's one real endpoint.
 * SUPER_ADMIN only, matching Platform Settings/Integrations' own
 * precedent for a genuinely platform-wide, cross-course view (Loop
 * deliberately ignores per-course ownership — an ADMIN/INSTRUCTOR's
 * usual "only what I created" scoping doesn't apply here, the same way
 * it doesn't for the platform-settings routes).
 *
 * The hard safety property this route exists to preserve: Loop can
 * observe, report, and PROPOSE a message or a module's learning
 * objectives, but it can never write either one itself. That's
 * enforced structurally, not by asking the model nicely:
 *   - `tools` below is the COMPLETE list of things Claude may call.
 *     Every read-only one is a plain Prisma query (see
 *     src/lib/loop/tools.ts's own comment). `present_report`,
 *     `propose_message`, and `propose_learning_objectives` are all
 *     terminal, structured-output-only tools — none performs any real
 *     action. There is no create/update/delete tool anywhere in this
 *     list.
 *   - `resolve_recipients` and `analyze_module_materials` are both
 *     intercepted by THIS route before the generic dispatch below ever
 *     runs — Claude never sees the actual RecipientFilter/resolved
 *     recipient list, nor the real module id being analyzed, only a
 *     count/short preview or a materials summary (see each
 *     interception below for exactly why).
 *   - `propose_message` and `propose_learning_objectives` both have
 *     schemas with NO identifying/routing fields at all (no recipient
 *     fields; no moduleId). The route attaches its own server-side-
 *     remembered state to build the proposal, so Claude structurally
 *     cannot alter or hallucinate who a message goes to, or which
 *     module a set of objectives belongs to.
 *   - This route never writes anything except the audit log
 *     (`AiCommandLog`) — never a `LoopBroadcast`, `UserNotification`,
 *     or `ModuleLearningObjective`. The actual writes happen only in
 *     POST /api/admin/messages/broadcast and
 *     POST /api/admin/loop/objectives/confirm, completely separate,
 *     non-AI endpoints that fire only on the Super Admin's own
 *     explicit confirmation click.
 */
const AskSchema = z.object({ question: z.string().trim().min(1).max(2000) });

const MODEL = "claude-sonnet-4-5";
const MAX_ROUNDS = 6;

const SYSTEM_PROMPT = `You are Loop, the AI executive assistant to the Super Admin of the AAICBI Learning Management System.

You have read-only access to real platform data through the tools provided — trainees, employers, staff, cohorts, and platform-wide numbers. You cannot create, update, or delete anything anywhere in the platform; no such tool exists for you to call, on purpose. Your only job is to observe, report, and — when asked to notify or message someone — prepare a message for the admin to review. You never send anything yourself.

Rules:
- Ground every number and claim in data you actually retrieved via a tool call this conversation. Never state a figure you didn't look up.
- If a name is ambiguous or you can't find a match, say so plainly and ask a clarifying question instead of guessing.
- When useful, name a concrete next step the admin could take (e.g. "message the at-risk trainees", "review the pending job posting") — but always phrase it as a suggestion for a human to act on, never as something you did or will do yourself.
- Keep answers concise and readable: short paragraphs and, where it helps, a bulleted list. Avoid padding a simple answer with unnecessary caveats.
- When you're ready to answer a REPORTING question, call present_report exactly once as your final step.
- When the admin asks you to notify/message/announce something to people: first call resolve_recipients (searching for a named individual with search_people first, if that's what's meant) to find out who and how many, then call propose_message exactly once as your final step — never present_report for a messaging request, and never claim to have sent anything, since propose_message only prepares a message for the admin to confirm or cancel. If resolve_recipients comes back ambiguous or with zero matches, ask a plain clarifying question instead of calling propose_message.
- When asked about a module's learning objectives, or to generate exam questions for a module that doesn't have confirmed objectives yet: call analyze_module_materials first, then propose_learning_objectives exactly once as your final step. This does not save anything — only the admin's own confirmation does. If analyze_module_materials comes back with no module found, ambiguous matches, or no usable materials, ask a plain clarifying question instead of calling propose_learning_objectives. Be honest about materials that couldn't be analyzed (only Word documents are supported right now) rather than guessing at their content.
- When asked to generate exam questions for a module that already has a confirmed learning objective matching the request, call generate_bank_questions, then summarize the result with present_report. Never claim a generated question has been approved or is live — only that it's been generated and is now awaiting the admin's review. If generate_bank_questions returns an error (no matching objective, ambiguous match), relay that plainly and suggest confirming objectives first if none exist.
- When asked to run validation on a module's pending questions, call run_bank_validation, then summarize the result with present_report — say how many passed and are now live in the bank versus how many were flagged for the admin's second review. Never claim a flagged question has been approved.
- Never call any tool after present_report, propose_message, or propose_learning_objectives in the same turn.`;

const PRESENT_REPORT_TOOL = {
  name: "present_report",
  description: "Call this exactly once, as your final step, to deliver your answer to a REPORTING question. Never use this for a request to notify/message/announce something to people — use propose_message instead. Do not call any other tool after this.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "The full answer to the admin's question, in plain prose (short paragraphs and/or a bulleted list). Ground every claim in data retrieved this conversation.",
      },
      keyStats: {
        type: "array",
        description: "0 to 4 headline numbers worth highlighting, e.g. {label: 'Completion rate', value: '68%'}. Omit if the answer has no natural headline numbers.",
        items: {
          type: "object",
          properties: { label: { type: "string" }, value: { type: "string" } },
          required: ["label", "value"],
        },
      },
    },
    required: ["summary"],
  },
};

const PROPOSE_MESSAGE_TOOL = {
  name: "propose_message",
  description: "Call this exactly once, as your final step, when the admin has asked you to notify/message/announce something to people, and you've already called resolve_recipients this conversation. This does NOT send anything — it only prepares a proposal for the admin to confirm or cancel. Do not call any other tool after this.",
  input_schema: {
    type: "object" as const,
    properties: {
      subject: { type: "string", description: "A short subject/title line for the message." },
      body: { type: "string", description: "The full message text the recipients would see." },
      category: { type: "string", description: "A short label for this message, e.g. \"SCHEDULE_CHANGE\", \"ANNOUNCEMENT\", \"MAINTENANCE\"." },
    },
    required: ["subject", "body", "category"],
  },
};

const PROPOSE_LEARNING_OBJECTIVES_TOOL = {
  name: "propose_learning_objectives",
  description: "Call this exactly once, as your final step, after you've already called analyze_module_materials this conversation. This does NOT save anything — it only prepares the objectives for the admin to confirm or cancel. You may restate or lightly polish the draft objectives' wording, but do not invent new ones beyond what analyze_module_materials returned. Do not call any other tool after this.",
  input_schema: {
    type: "object" as const,
    properties: {
      objectives: {
        type: "array",
        description: "The final list of objectives to propose, one string each.",
        items: { type: "string" },
      },
    },
    required: ["objectives"],
  },
};

interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
}

interface ResolvedFilterState {
  filter: RecipientFilter;
  description: string;
  count: number;
  truncated: boolean;
}

interface AnalyzedModuleState {
  moduleId: string;
  moduleDescription: string;
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    const limited = await rateLimit(`loop-ask:${session.userId}:${clientIp(req)}`, 30, 15 * 60 * 1000);
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Too many questions in a short time. Please wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = AskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "A question is required." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Loop isn't configured yet — ANTHROPIC_API_KEY is missing. See DEPLOYMENT.md." },
        { status: 503 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 25_000 });
    const tools = [...LOOP_TOOL_SCHEMAS, PRESENT_REPORT_TOOL, PROPOSE_MESSAGE_TOOL, PROPOSE_LEARNING_OBJECTIVES_TOOL];
    const toolCallLog: ToolCallRecord[] = [];

    let messages: Anthropic.MessageParam[] = [{ role: "user", content: parsed.data.question }];
    let finalSummary: string | null = null;
    let finalStats: Array<{ label: string; value: string }> = [];
    let finalMessageProposal: {
      recipientDescription: string;
      recipientFilter: RecipientFilter;
      recipientCount: number;
      truncated: boolean;
      subject: string;
      body: string;
      category: string;
    } | null = null;
    let finalObjectivesProposal: {
      moduleId: string;
      moduleDescription: string;
      objectives: string[];
    } | null = null;
    // The route's own memory of the last resolve_recipients call this
    // conversation — never sent to Claude, only ever attached by this
    // route itself when propose_message is called. This is the actual
    // mechanism that makes it structurally impossible for Claude to
    // alter who a proposed message goes to.
    let lastResolvedFilter: ResolvedFilterState | null = null;
    // Same mechanism, for objectives: which module was actually
    // analyzed this conversation, remembered server-side so
    // propose_learning_objectives's own schema never needs (and never
    // gets) a moduleId field Claude could alter or hallucinate.
    let lastAnalyzedModule: AnalyzedModuleState | null = null;

    try {
      for (
        let round = 0;
        round < MAX_ROUNDS && finalSummary === null && finalMessageProposal === null && finalObjectivesProposal === null;
        round++
      ) {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools,
          messages,
        });

        messages = [...messages, { role: "assistant", content: response.content }];

        if (response.stop_reason !== "tool_use") {
          // Fallback: Claude answered in plain text without calling a
          // terminal tool. Still a real, usable answer — don't force
          // an error just because it skipped the formality.
          const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
          finalSummary = textBlock?.text ?? "I wasn't able to put together an answer for that. Try rephrasing the question.";
          break;
        }

        const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.name === "present_report") {
            const input = block.input as { summary?: string; keyStats?: Array<{ label: string; value: string }> };
            finalSummary = input.summary ?? "";
            finalStats = Array.isArray(input.keyStats) ? input.keyStats : [];
            break; // ignore anything after a terminal tool call in the same turn
          }

          if (block.name === "propose_message") {
            if (!lastResolvedFilter) {
              // Structural guard, not just a prompt instruction: refuse
              // to treat this as terminal until a real resolve_recipients
              // call has actually happened this conversation.
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: "You must call resolve_recipients before propose_message, so the admin sees an accurate recipient count.",
                is_error: true,
              });
              continue;
            }
            const input = block.input as { subject?: string; body?: string; category?: string };
            finalMessageProposal = {
              recipientDescription: lastResolvedFilter.description,
              recipientFilter: lastResolvedFilter.filter,
              recipientCount: lastResolvedFilter.count,
              truncated: lastResolvedFilter.truncated,
              subject: input.subject ?? "",
              body: input.body ?? "",
              category: input.category ?? "ANNOUNCEMENT",
            };
            break; // ignore anything after a terminal tool call in the same turn
          }

          if (block.name === "propose_learning_objectives") {
            if (!lastAnalyzedModule) {
              // Same structural guard as propose_message above: refuse
              // to treat this as terminal until a real
              // analyze_module_materials call has actually happened
              // this conversation.
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content:
                  "You must call analyze_module_materials before propose_learning_objectives, so the objectives are grounded in a specific module's real materials.",
                is_error: true,
              });
              continue;
            }
            const input = block.input as { objectives?: unknown };
            const objectives = Array.isArray(input.objectives)
              ? input.objectives.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
              : [];
            finalObjectivesProposal = {
              moduleId: lastAnalyzedModule.moduleId,
              moduleDescription: lastAnalyzedModule.moduleDescription,
              objectives,
            };
            break; // ignore anything after a terminal tool call in the same turn
          }

          if (block.name === "analyze_module_materials") {
            // Intercepted here, before the generic dispatcher — same
            // reasoning as resolve_recipients below: this performs real
            // work (reading materials, drafting objectives with an AI
            // call), and the route needs to remember the real moduleId
            // server-side so propose_learning_objectives's schema never
            // needs one Claude could alter.
            const input = (block.input ?? {}) as { moduleQuery?: string; description?: string };
            toolCallLog.push({ tool: block.name, input });
            const moduleQuery = typeof input.moduleQuery === "string" ? input.moduleQuery : "";
            const lookup = await resolveModuleByQuery(moduleQuery);

            if (!lookup.module) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({ found: false, ambiguousMatches: lookup.ambiguousMatches }),
              });
              continue;
            }

            const materials = await getModuleMaterialsText(lookup.module.id);
            const moduleDescription = `${lookup.module.courseTitle} — ${lookup.module.title}`;

            if (materials.usable.length === 0) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  found: true,
                  module: moduleDescription,
                  materialsAnalyzed: 0,
                  materialsSkipped: materials.skipped,
                  error: "No usable materials found for this module — only Word documents can be analyzed right now.",
                }),
              });
              continue;
            }

            let drafted;
            try {
              drafted = await draftLearningObjectives(lookup.module.title, materials.usable);
            } catch (e) {
              console.error("Loop: draftLearningObjectives failed:", e);
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify({
                  found: true,
                  module: moduleDescription,
                  error: "Couldn't draft objectives from these materials right now — try again.",
                }),
              });
              continue;
            }

            lastAnalyzedModule = { moduleId: lookup.module.id, moduleDescription };
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify({
                found: true,
                module: moduleDescription,
                materialsAnalyzed: materials.usable.length,
                materialsSkipped: materials.skipped,
                foundExplicitObjectives: drafted.foundExplicitObjectives,
                draftObjectives: drafted.objectives,
              }),
            });
            continue;
          }

          if (block.name === "resolve_recipients") {
            // Intercepted here, before the generic dispatcher — Claude
            // never receives the real filter or recipient list, only
            // the summary below. See this route's own top comment.
            const input = (block.input ?? {}) as Record<string, unknown>;
            toolCallLog.push({ tool: block.name, input });
            const filter = buildRecipientFilterFromToolInput(input);
            const description = typeof input.description === "string" ? input.description : "the selected recipients";
            const result = await resolveRecipients(filter);
            lastResolvedFilter = { filter, description, count: result.recipients.length, truncated: result.truncated };
            const summary = {
              recipientCount: result.recipients.length,
              previewNames: result.recipients.slice(0, 10).map((r) => r.name),
              truncated: result.truncated,
              ambiguousMatches: result.ambiguousMatches,
            };
            toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(summary) });
            continue;
          }

          const input = (block.input ?? {}) as Record<string, unknown>;
          toolCallLog.push({ tool: block.name, input });
          const result = await runLoopTool(block.name, input, session.userId);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }

        if (finalSummary !== null || finalMessageProposal !== null || finalObjectivesProposal !== null) break;
        messages = [...messages, { role: "user", content: toolResults }];
      }
    } catch (e) {
      console.error("Loop: Anthropic call failed:", e);
      return NextResponse.json({ error: "Loop couldn't reach the AI service just now. Please try again." }, { status: 502 });
    }

    if (finalSummary === null && finalMessageProposal === null && finalObjectivesProposal === null) {
      finalSummary = "That question needed more steps than I'm allowed to take at once — try breaking it into a more specific question.";
    }

    // AiCommandLog stays Loop's complete Q&A trail regardless of
    // whether this turn produced a report or a proposal — a proposal
    // that's later cancelled (or never acted on) is still worth
    // remembering was asked for.
    const auditAnswer =
      finalMessageProposal !== null
        ? `Proposed a message to ${finalMessageProposal.recipientCount} recipient(s) ("${finalMessageProposal.recipientDescription}"): "${finalMessageProposal.subject}"`
        : finalObjectivesProposal !== null
          ? `Drafted ${finalObjectivesProposal.objectives.length} learning objective(s) for ${finalObjectivesProposal.moduleDescription}`
          : (finalSummary as string);

    await prisma.aiCommandLog
      .create({
        data: {
          askedById: session.userId,
          question: parsed.data.question,
          answer: auditAnswer,
          toolCalls: toolCallLog as unknown as object,
        },
      })
      .catch((e) => console.error("Failed to write AiCommandLog:", e));

    if (finalMessageProposal !== null) {
      return NextResponse.json({ kind: "messageProposal", proposal: finalMessageProposal });
    }
    if (finalObjectivesProposal !== null) {
      return NextResponse.json({ kind: "objectivesProposal", proposal: finalObjectivesProposal });
    }
    return NextResponse.json({ kind: "answer", answer: finalSummary, keyStats: finalStats });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { TRAINEE_TOOL_SCHEMAS, runTraineeLoopTool } from "@/lib/loop/traineeTools";

/**
 * POST /api/trainee/loop/ask — Loop's trainee-facing persona, the
 * Learning Buddy. Same brand, same underlying tool-calling engine as
 * the staff Executive Assistant (src/app/api/admin/loop/ask/route.ts —
 * this route deliberately mirrors its control flow), a different
 * system prompt and a completely separate, trainee-scoped tool
 * catalog (src/lib/loop/traineeTools.ts).
 *
 * Two things make this the trainee twin, not just a smaller copy:
 *   - Every tool here takes NO identifying input at all — the route
 *     always supplies `session.userId` as the scope, the model never
 *     sees or sets a trainee/course id. There is structurally no way
 *     for this persona to ask for or receive another trainee's data.
 *   - Only one terminal tool (`present_response`) exists — no
 *     `propose_message`/`propose_learning_objectives` equivalents,
 *     since this persona has no staff-facing write path to propose
 *     into. Every turn is just a grounded answer.
 *
 * Gated on `Trainee.aiStudyBuddyEnabled` (already a real, working
 * settings toggle — see src/app/trainee/settings/page.tsx — built
 * ahead of this feature and inert until now) rather than a new flag.
 */
const AskSchema = z.object({ question: z.string().trim().min(1).max(2000) });

const MODEL = "claude-sonnet-4-5";
const MAX_ROUNDS = 6;

const SYSTEM_PROMPT = `You are Loop, the trainee's own AI learning buddy on the AAICBI Learning Management System.

You have read-only access to this trainee's OWN real learning data through the tools provided — their course progress, past assessment performance, achievements, and recent activity. You cannot see any other trainee's data, and there is no tool that could show you exam questions, answers, or question-bank content — you genuinely don't have access to any of that, by design.

Rules:
- Ground every number and claim in data you actually retrieved via a tool call this conversation. Never state a figure you didn't look up, and never invent a score, topic, achievement, or result.
- Speak like a warm, respectful, honest mentor — encouraging but never with empty praise. When there's real evidence of improvement, cite the actual numbers (e.g. "you went from 43% to 58%"). When performance is weak in an area, say so plainly and kindly, then suggest a concrete next step.
- Never shame, ridicule, or compare the trainee to anyone else. Never claim to know how the trainee feels or use language implying human emotion of your own.
- Never guarantee a job, career outcome, or certification — you can discuss what's been demonstrated so far and what's still ahead, never a promise.
- If asked something you have no data for, say so plainly rather than guessing.
- Keep answers concise and readable: short paragraphs, and a bulleted list where it helps.
- When you're ready to answer, call present_response exactly once as your final step. Never call any tool after it in the same turn.`;

const PRESENT_RESPONSE_TOOL = {
  name: "present_response",
  description: "Call this exactly once, as your final step, to deliver your answer to the trainee. Do not call any other tool after this.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "The full answer to the trainee's question, in plain, warm prose. Ground every claim in data retrieved this conversation.",
      },
      keyStats: {
        type: "array",
        description: "0 to 4 headline numbers worth highlighting, e.g. {label: 'Modules completed', value: '4 of 6'}. Omit if the answer has no natural headline numbers.",
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

interface ToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
}

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const trainee = await prisma.trainee.findUnique({
      where: { id: session.userId },
      select: { aiStudyBuddyEnabled: true },
    });
    if (!trainee?.aiStudyBuddyEnabled) {
      return NextResponse.json(
        { error: "Turn on AI Study Buddy in Settings to start chatting with Loop." },
        { status: 403 }
      );
    }

    const limited = await rateLimit(`learning-buddy-ask:${session.userId}:${clientIp(req)}`, 30, 15 * 60 * 1000);
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
    const tools = [...TRAINEE_TOOL_SCHEMAS, PRESENT_RESPONSE_TOOL];
    const toolCallLog: ToolCallRecord[] = [];

    let messages: Anthropic.MessageParam[] = [{ role: "user", content: parsed.data.question }];
    let finalSummary: string | null = null;
    let finalStats: Array<{ label: string; value: string }> = [];

    try {
      for (let round = 0; round < MAX_ROUNDS && finalSummary === null; round++) {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools,
          messages,
        });

        messages = [...messages, { role: "assistant", content: response.content }];

        if (response.stop_reason !== "tool_use") {
          const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
          finalSummary = textBlock?.text ?? "I wasn't able to put together an answer for that. Try rephrasing the question.";
          break;
        }

        const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.name === "present_response") {
            const input = block.input as { summary?: string; keyStats?: Array<{ label: string; value: string }> };
            finalSummary = input.summary ?? "";
            finalStats = Array.isArray(input.keyStats) ? input.keyStats : [];
            break; // ignore anything after a terminal tool call in the same turn
          }

          toolCallLog.push({ tool: block.name, input: (block.input ?? {}) as Record<string, unknown> });
          const result = await runTraineeLoopTool(block.name, session.userId);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }

        if (finalSummary !== null) break;
        messages = [...messages, { role: "user", content: toolResults }];
      }
    } catch (e) {
      console.error("Loop (trainee): Anthropic call failed:", e);
      return NextResponse.json({ error: "Loop couldn't reach the AI service just now. Please try again." }, { status: 502 });
    }

    if (finalSummary === null) {
      finalSummary = "That question needed more steps than I'm allowed to take at once — try breaking it into a more specific question.";
    }

    await prisma.aiCommandLog
      .create({
        data: {
          askedByTraineeId: session.userId,
          question: parsed.data.question,
          answer: finalSummary,
          toolCalls: toolCallLog as unknown as object,
        },
      })
      .catch((e) => console.error("Failed to write AiCommandLog:", e));

    return NextResponse.json({ answer: finalSummary, keyStats: finalStats });
  });
}

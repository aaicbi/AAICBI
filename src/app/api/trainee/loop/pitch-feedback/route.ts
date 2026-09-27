import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/**
 * POST /api/trainee/loop/pitch-feedback — Pitch & Post's Loop persona,
 * "Pitch Coach." Same brand and gating as the Learning Buddy
 * (src/app/api/trainee/loop/ask/route.ts — same aiStudyBuddyEnabled
 * toggle, no new setting invented; same rate-limit shape; an
 * AiCommandLog row per turn), but genuinely simpler in one respect:
 * the Learning Buddy needs tool calls because it has to fetch the
 * trainee's data from the database. A pitch draft is small and already
 * sitting in the browser's own form state, so the client sends it
 * directly here and Loop answers in one call — nothing to fetch, and
 * nothing to hallucinate about beyond what's already been typed.
 *
 * Deliberate scope boundary, enforced in the system prompt: Loop
 * coaches on pitch CRAFT — clarity, completeness, structure, what's
 * missing — and never on the business's viability, financial
 * soundness, or investment merit. That judgment belongs to AAICBI's
 * human review and, eventually, to investors themselves.
 */
const DraftSchema = z.object({
  startupName: z.string().max(160).optional(),
  industry: z.string().max(120).optional(),
  problem: z.string().max(4000).optional(),
  solution: z.string().max(4000).optional(),
  targetMarket: z.string().max(2000).optional(),
  businessModel: z.string().max(2000).optional(),
  stage: z.string().max(120).optional(),
  traction: z.string().max(2000).optional(),
  teamDescription: z.string().max(2000).optional(),
  fundingType: z.string().max(40).optional(),
  fundingAmountKobo: z.number().optional(),
  fundingPurpose: z.string().max(2000).optional(),
});

const AskSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  draft: DraftSchema,
});

const MODEL = "claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are Loop, here to help an AAICBI trainee strengthen their startup pitch before they submit it for review.

You are given the founder's current draft (whatever they've filled in so far — some fields may be empty) and their question, in the user's message.

Rules:
- Coach on pitch CRAFT ONLY: clarity, completeness, structure, what's vague or missing, how to make a strong point stronger. NEVER comment on whether the business idea itself is a good investment, financially sound, or likely to succeed — that is not your role, and AAICBI's own staff review (and eventually investors) make that judgment, not you.
- Guide, don't ghostwrite: ask questions, point out gaps, suggest what a strong version would cover structurally — never write replacement paragraphs of the founder's problem/solution/etc. for them. This is their pitch, not yours.
- Ground every observation only in the draft you were actually given. Never invent facts about the business, its market, or its numbers.
- Speak like a warm, honest, concrete mentor — no empty praise, no discouragement. If something is genuinely strong, say so plainly; if something is thin or unclear, say so plainly and suggest what to consider adding.
- Keep answers concise: short paragraphs, a short bulleted list where it helps.
- Never guarantee approval, funding, or investor interest.`;

export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");

    const trainee = await prisma.trainee.findUnique({
      where: { id: session.userId },
      select: { aiStudyBuddyEnabled: true },
    });
    if (!trainee?.aiStudyBuddyEnabled) {
      return NextResponse.json(
        { error: "Turn on AI Study Buddy in Settings to get pitch feedback from Loop." },
        { status: 403 }
      );
    }

    const limited = await rateLimit(`pitch-coach-ask:${session.userId}:${clientIp(req)}`, 30, 15 * 60 * 1000);
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
    const userMessage = `Here is my current pitch draft (some fields may be empty):\n${JSON.stringify(parsed.data.draft, null, 2)}\n\nMy question: ${parsed.data.question}`;

    let answer: string;
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      answer = textBlock?.text ?? "I wasn't able to put together an answer for that. Try rephrasing the question.";
    } catch (e) {
      console.error("Loop (pitch coach): Anthropic call failed:", e);
      return NextResponse.json({ error: "Loop couldn't reach the AI service just now. Please try again." }, { status: 502 });
    }

    await prisma.aiCommandLog
      .create({
        data: {
          askedByTraineeId: session.userId,
          question: parsed.data.question,
          answer,
          toolCalls: [] as unknown as object,
        },
      })
      .catch((e) => console.error("Failed to write AiCommandLog:", e));

    return NextResponse.json({ answer });
  });
}

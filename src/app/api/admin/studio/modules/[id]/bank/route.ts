import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { approveQuestions, assignQuestions, bankOverview, copyQuestions, BankError, editQuestion, generateQuestions, rejectQuestions, reviewQuestions } from "@/lib/quest/bank";

// Writing or reviewing a batch calls Claude, so give the request the time it needs.
export const maxDuration = 60;

/** GET: the module's question bank as the studio shows it: what each objective still needs, and what is waiting for a decision. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    await requireStudioModule(params.id, session);
    return NextResponse.json(await bankOverview(params.id));
  });
}

const Pool = z.enum(["PRACTICE", "FORMAL"]);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), objectiveId: z.string().min(1), count: z.number().int().min(1).max(10), pool: Pool.optional() }),
  z.object({ action: z.literal("review"), objectiveId: z.string().optional(), ids: z.array(z.string()).max(200).optional() }),
  z.object({ action: z.literal("approve"), ids: z.array(z.string()).max(200).optional(), allPassed: z.boolean().optional(), pool: Pool.optional() }),
  z.object({ action: z.literal("assign"), pool: Pool, ids: z.array(z.string()).max(200).optional(), allUnassigned: z.boolean().optional() }),
  z.object({ action: z.literal("copy"), to: Pool, ids: z.array(z.string()).min(1).max(50) }),
  z.object({ action: z.literal("reject"), ids: z.array(z.string()).min(1).max(200) }),
  z.object({
    action: z.literal("edit"),
    id: z.string().min(1),
    text: z.string().min(3).max(1000),
    options: z.array(z.object({ text: z.string().max(500), isCorrect: z.boolean() })).min(2).max(6),
  }),
]);

/** POST: write questions, have the reviewer check them, approve, reject or edit. Needs the question-bank permission. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "BANK_AI");
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That request wasn't understood." }, { status: 400 });
    const b = parsed.data;
    try {
      switch (b.action) {
        case "generate":
          return NextResponse.json(await generateQuestions(params.id, session.userId, { objectiveId: b.objectiveId, count: b.count, pool: b.pool }));
        case "review":
          return NextResponse.json(await reviewQuestions(params.id, { objectiveId: b.objectiveId, questionIds: b.ids }));
        case "approve":
          return NextResponse.json(await approveQuestions(params.id, session.userId, { ids: b.ids, allPassed: b.allPassed, pool: b.pool }));
        case "assign":
          return NextResponse.json(await assignQuestions(params.id, session.userId, { ids: b.ids, allUnassigned: b.allUnassigned, pool: b.pool }));
        case "copy":
          return NextResponse.json(await copyQuestions(params.id, session.userId, { ids: b.ids, to: b.to }));
        case "reject":
          return NextResponse.json(await rejectQuestions(params.id, session.userId, b.ids));
        case "edit":
          return NextResponse.json(await editQuestion(params.id, session.userId, b.id, { text: b.text, options: b.options }));
      }
    } catch (e) {
      if (e instanceof BankError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

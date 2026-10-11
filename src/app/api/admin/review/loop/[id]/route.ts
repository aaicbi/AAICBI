import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireReviewer } from "@/lib/review/access";
import { LoopReviewError, answerQuestion, escalateQuestion, rejectQuestion, returnQuestion } from "@/lib/guide/review";

export const dynamic = "force-dynamic";

/**
 * POST — a reviewer deals with a question Loop could not answer:
 *   { action: "answer", question, answer, ... }  approve an answer into Loop's knowledge
 *   { action: "reject", note }                   decline it, with a reason
 *   { action: "escalate", note }                 send it to the super admin
 *   { action: "return" }                         (super admin) send an escalated one back
 * Settings, the Claude consultant and AI guidance are not reachable from here.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await requireReviewer();
    const body = await req.json().catch(() => null);
    const kind = z.object({ action: z.enum(["answer", "reject", "escalate", "return"]) }).safeParse(body);
    if (!kind.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      switch (kind.data.action) {
        case "answer": return NextResponse.json({ id: await answerQuestion(params.id, body, actor) }, { status: 201 });
        case "reject": await rejectQuestion(params.id, body?.note, actor); break;
        case "escalate": await escalateQuestion(params.id, body?.note, actor); break;
        case "return": await returnQuestion(params.id, actor); break;
      }
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof LoopReviewError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

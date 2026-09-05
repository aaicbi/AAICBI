import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { recordAnswer } from "@/lib/examEngine";

const AnswerSchema = z.object({
  questionId: z.string(),
  selectedOptionKey: z.string().nullable(),
});

/**
 * Called on every option click, not just at submit — so an attempt
 * always has the student's latest choices saved server-side even if
 * their connection drops before they hit Submit (§34's "preserve
 * answers, sync when connectivity returns"). The client can queue these
 * locally and retry; the server doesn't need to know or care.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const body = await req.json();
    const parsed = AnswerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid answer payload." }, { status: 400 });
    }
    await recordAnswer(params.id, parsed.data.questionId, parsed.data.selectedOptionKey);
    return NextResponse.json({ ok: true });
  });
}

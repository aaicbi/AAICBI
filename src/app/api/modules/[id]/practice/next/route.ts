import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { serveQuestion } from "@/lib/quest/server";

const Body = z.object({ objectiveId: z.string().min(1).nullable().optional() });

/**
 * POST /api/modules/[id]/practice/next — serve the next practice question
 * (for one objective, or the weakest one). The answer key is never sent; the
 * server starts the clock when it serves the question.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const served = await serveQuestion(session.userId, params.id, parsed.data.objectiveId ?? null);
    if (!served) return NextResponse.json({ done: true, message: "There are no practice questions to serve right now." });
    return NextResponse.json({ done: false, ...served });
  });
}

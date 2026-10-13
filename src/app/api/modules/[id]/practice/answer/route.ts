import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { submitAnswer } from "@/lib/quest/server";

const Body = z.object({ practiceAnswerId: z.string().min(1), selectedKey: z.string().min(1).max(20) });

/** POST /api/modules/[id]/practice/answer — grade on the server, pay XP, update mastery. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return NextResponse.json(await submitAnswer(session.userId, params.id, parsed.data.practiceAnswerId, parsed.data.selectedKey));
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { answerGameItem } from "@/lib/quest/studio";

const Body = z.object({ playId: z.string().min(1), response: z.unknown() });

/** POST — grade on the server, pay XP by the same rules as practice. */
export async function POST(req: NextRequest, { params }: { params: { id: string; gameId: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Answer first." }, { status: 400 });
    return NextResponse.json(await answerGameItem(session.userId, params.id, params.gameId, parsed.data.playId, parsed.data.response));
  });
}

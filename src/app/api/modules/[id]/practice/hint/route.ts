import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { useHint } from "@/lib/quest/server";

const Body = z.object({ practiceAnswerId: z.string().min(1) });

/** POST /api/modules/[id]/practice/hint — points to where the answer is taught; the answer itself stays hidden. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    return NextResponse.json(await useHint(session.userId, params.id, parsed.data.practiceAnswerId));
  });
}

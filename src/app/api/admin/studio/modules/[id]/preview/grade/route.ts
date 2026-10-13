import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { isGameFormat, previewGrade } from "@/lib/quest/studio";

const Body = z.object({ format: z.string().refine(isGameFormat, "Unknown format"), itemId: z.string().min(1), response: z.unknown() });

/** POST — grade a preview answer. Nothing is recorded and no XP is paid. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Answer first." }, { status: 400 });
    return NextResponse.json(await previewGrade(params.id, parsed.data.format as never, parsed.data.itemId, parsed.data.response));
  });
}

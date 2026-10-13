import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { createItem } from "@/lib/quest/studio";

const Body = z.object({ objectiveId: z.string().min(1), format: z.string(), content: z.unknown() });

/** POST — a person writes an item for a module. It is approved straight away because a person wrote it. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose an objective and a format." }, { status: 400 });
    const created = await createItem(params.id, { objectiveId: parsed.data.objectiveId, format: parsed.data.format, content: parsed.data.content ?? null, source: "STAFF" });
    return NextResponse.json(created, { status: 201 });
  });
}

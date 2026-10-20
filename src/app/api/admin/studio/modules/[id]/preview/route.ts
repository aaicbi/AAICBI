import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioCan } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { isGameFormat, previewServe } from "@/lib/quest/studio";

const Body = z.object({ format: z.string().refine(isGameFormat, "Unknown format"), index: z.number().int().default(0) });

/** POST — serve one item for preview. Records nothing and includes drafts so they can be tried before approval. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioCan(session, "gaming_studio.testing:view");
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a format." }, { status: 400 });
    const served = await previewServe(params.id, parsed.data.format as never, parsed.data.index);
    return NextResponse.json(served ?? { empty: true });
  });
}

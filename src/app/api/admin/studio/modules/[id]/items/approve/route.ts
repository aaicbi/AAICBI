import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { approveDrafts } from "@/lib/quest/studio";
import { isItemFormat } from "@/lib/quest/games";

const Body = z.object({ format: z.string().refine(isItemFormat, "Unknown format") });

/** POST — approve every draft of one format in this module. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a format." }, { status: 400 });
    const approved = await approveDrafts(params.id, parsed.data.format as never, session.userId);
    return NextResponse.json({ approved });
  });
}

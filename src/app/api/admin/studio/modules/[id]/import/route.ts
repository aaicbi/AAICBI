import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { ImportError, applyImport, previewImport } from "@/lib/quest/contentImportApply";

export const maxDuration = 60;

const Body = z.object({ file: z.unknown(), apply: z.boolean().optional(), createGames: z.boolean().optional() });

/**
 * POST: a reviewed content file for this module. Without `apply` it only says what would be saved (nothing is written). With `apply` it
 * saves quiz questions as "passed review" and game items as drafts, adds missing objectives, and (optionally) attaches the games switched
 * off. Needs the question-bank permission (quiz questions) and the item permission (game items), plus the games one to create games.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "BANK_AI");
    requireStudioPermission(session, "ITEMS");
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a content file." }, { status: 400 });
    try {
      if (!parsed.data.apply) return NextResponse.json(await previewImport(params.id, parsed.data.file));
      if (parsed.data.createGames) requireStudioPermission(session, "GAMES");
      return NextResponse.json(await applyImport(params.id, session.userId, parsed.data.file, { createGames: !!parsed.data.createGames }));
    } catch (e) {
      if (e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

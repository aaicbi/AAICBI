import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioModule, requireStudioCan } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { ImportError, applyImport, previewImport } from "@/lib/quest/contentImportApply";

export const maxDuration = 60;

const Body = z.object({ file: z.unknown(), apply: z.boolean().optional(), createGames: z.boolean().optional(), only: z.array(z.number().int().min(0).max(30)).max(30).optional(), choices: z.record(z.string().max(60)).optional(), reserve: z.number().int().min(0).max(10).optional() });

/**
 * POST: a reviewed content file for this module. Without `apply` it only says what would be saved (nothing is written). With `apply` it
 * saves quiz questions as "passed review" and game items as drafts, adds missing objectives, and (optionally) attaches the games switched
 * off. Needs the question-bank permission (quiz questions) and the item permission (game items), plus the games one to create games.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioCan(session, "gaming_studio.bank:manage");
    requireStudioCan(session, "gaming_studio.assets:manage");
    await requireStudioModule(params.id, session);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a content file." }, { status: 400 });
    try {
      if (!parsed.data.apply) return NextResponse.json(await previewImport(params.id, parsed.data.file, { choices: parsed.data.choices, reserve: parsed.data.reserve }));
      if (parsed.data.createGames) requireStudioCan(session, "gaming_studio.games:create");
      return NextResponse.json(await applyImport(params.id, session.userId, parsed.data.file, { createGames: !!parsed.data.createGames, only: parsed.data.only, choices: parsed.data.choices, reserve: parsed.data.reserve }));
    } catch (e) {
      if (e instanceof ImportError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

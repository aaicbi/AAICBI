import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/translations?language=yo — the trainee-facing counterpart
 * to /api/admin/translations. Deliberately a completely separate
 * route rather than the same one with a role check inside it: this
 * one only ever returns `approved: true` rows, full stop — there's no
 * code path here that could accidentally leak an unreviewed draft to
 * a trainee, which a single shared route with conditional filtering
 * would leave open to exactly that kind of mistake.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await getSession();
    if (!session) {
      const err = new Error("Not authenticated") as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    const language = req.nextUrl.searchParams.get("language") ?? "en";
    if (language === "en") {
      return NextResponse.json({}); // English is the source text itself — nothing to look up
    }

    const rows = await prisma.uiStringTranslation.findMany({
      where: { language, approved: true },
      select: { sourceText: true, translatedText: true },
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.sourceText] = row.translatedText;
    return NextResponse.json(map);
  });
}

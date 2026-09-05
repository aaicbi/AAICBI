import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * M42 — every SUPER_ADMIN/ADMIN/INSTRUCTOR can see and review every
 * translation, unlike course-scoped resources elsewhere in this app.
 * Deliberate, not an oversight: a translation isn't owned by whoever
 * happened to trigger the draft the way a course is owned by whoever
 * created it — it's a shared, platform-wide piece of UI text, and
 * gatekeeping review by "who clicked the button" would just mean the
 * one Yoruba speaker on staff can't review a French draft someone
 * else triggered.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const translations = await prisma.uiStringTranslation.findMany({
      orderBy: [{ language: "asc" }, { sourceText: "asc" }],
      include: { approvedBy: { select: { name: true } } },
    });
    return NextResponse.json(translations);
  });
}

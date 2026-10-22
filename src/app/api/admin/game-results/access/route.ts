import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { accessList, resultsShared } from "@/lib/quest/results";
import { cleanPermissions, permissionsFrom } from "@/lib/quest/permissions";

export const dynamic = "force-dynamic";

/** GET: whether the table is shared with staff, and which staff may open it. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    return NextResponse.json({ shared: await resultsShared(), people: await accessList() });
  });
}

const Body = z.union([z.object({ shared: z.boolean() }), z.object({ userId: z.string().min(1), allowed: z.boolean() })]);

/** PUT: switch sharing on or off for everyone, or allow / stop one person from opening the table. Super Admin only. */
export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a switch to change." }, { status: 400 });
    const b = parsed.data;
    if ("shared" in b) {
      await prisma.platformSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", gameResultsShared: b.shared }, update: { gameResultsShared: b.shared } });
      return NextResponse.json({ ok: true });
    }
    const user = await prisma.user.findFirst({ where: { id: b.userId, role: { in: ["ADMIN", "INSTRUCTOR"] } }, select: { id: true, studioPermissions: true } });
    if (!user) return NextResponse.json({ error: "That person could not be found." }, { status: 404 });
    const current = permissionsFrom(user.studioPermissions).filter((k) => k !== "GAME_RESULTS");
    await prisma.user.update({ where: { id: user.id }, data: { studioPermissions: cleanPermissions(b.allowed ? [...current, "GAME_RESULTS"] : current) } });
    return NextResponse.json({ ok: true });
  });
}

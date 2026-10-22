import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { clampLevel } from "@/lib/loop/policy";
import { STUDIO_PERMISSIONS, cleanPermissions, permissionsFrom } from "@/lib/quest/permissions";

export const dynamic = "force-dynamic";

/** GET: the staff who can use the studio, with the highest autonomy level each may use in Loop. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const people = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "INSTRUCTOR"] } },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, role: true, loopMaxLevel: true, studioPermissions: true },
    });
    return NextResponse.json({
      permissionOptions: STUDIO_PERMISSIONS,
      people: people.map((p) => ({ id: p.id, name: p.name, role: p.role, level: clampLevel(p.loopMaxLevel), permissions: permissionsFrom(p.studioPermissions) })),
    });
  });
}

const Body = z.object({ userId: z.string().min(1), level: z.number().int().min(1).max(3).optional(), permissions: z.array(z.string()).optional() }).refine((b) => b.level !== undefined || b.permissions !== undefined, "Nothing to change.");

/** PUT: raise or lower how much Loop may do on its own for one person (1 ask first, 2 balanced, 3 autonomous). */
export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a person, and a level from 1 to 3 or a list of permissions." }, { status: 400 });
    const user = await prisma.user.findFirst({ where: { id: parsed.data.userId, role: { in: ["ADMIN", "INSTRUCTOR"] } }, select: { id: true, loopLevel: true } });
    if (!user) return NextResponse.json({ error: "That person could not be found." }, { status: 404 });
    const data: { loopMaxLevel?: number; loopLevel?: number; studioPermissions?: string[] } = {};
    // Lowering the cap also lowers their current level if it was above it.
    if (parsed.data.level !== undefined) {
      data.loopMaxLevel = parsed.data.level;
      data.loopLevel = Math.min(user.loopLevel, parsed.data.level);
    }
    if (parsed.data.permissions !== undefined) data.studioPermissions = cleanPermissions(parsed.data.permissions);
    await prisma.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ ok: true });
  });
}

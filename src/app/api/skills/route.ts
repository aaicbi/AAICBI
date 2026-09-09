import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/skills?q=... — the canonical skill lookup, shared by the
 * trainee-profile skill picker (Phase 1) and, later, employer discovery
 * filtering (Phase 2). Any authenticated role can read it; there's
 * nothing sensitive in a skill name. No POST here — creating new
 * canonical skills is an admin action (Phase 3's admin console), so the
 * list a trainee picks from stays consistent rather than fragmenting
 * into near-duplicate entries.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole();
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const skills = await prisma.skill.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      select: { id: true, name: true, category: true },
      orderBy: { name: "asc" },
      take: 50,
    });
    return NextResponse.json(skills);
  });
}

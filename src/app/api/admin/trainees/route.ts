import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/admin/trainees?q=... — the trainee half of Phase 3's admin
 * profile-management console. No such list existed anywhere in this
 * app before (only a per-trainee ai-credits action route did) — this
 * is the new list/search surface, modeled on /api/admin/staff's own
 * list shape. SUPER_ADMIN/ADMIN only, matching every other
 * platform-wide-decision route in this app (never INSTRUCTOR, which
 * has no account-management authority elsewhere either).
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN", "ADMIN");
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const trainees = await prisma.trainee.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { username: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        createdAt: true,
        emailVerified: true,
        publiclyDiscoverable: true,
        qaSuspendedAt: true,
        _count: { select: { certificates: true, courseEnrollments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      trainees.map((t: (typeof trainees)[number]) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        username: t.username,
        createdAt: t.createdAt,
        emailVerified: t.emailVerified,
        publiclyDiscoverable: t.publiclyDiscoverable,
        suspended: t.qaSuspendedAt !== null,
        certificateCount: t._count.certificates,
        courseCount: t._count.courseEnrollments,
      }))
    );
  });
}

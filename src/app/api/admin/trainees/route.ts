import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveSegmentTraineeIds } from "@/lib/analytics/segments";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/trainees?q=...&segment=... — the trainee half of
 * Phase 3's admin profile-management console. No such list existed
 * anywhere in this app before (only a per-trainee ai-credits action
 * route did) — this is the new list/search surface, modeled on
 * /api/admin/staff's own list shape. SUPER_ADMIN/ADMIN only, matching
 * every other platform-wide-decision route in this app (never
 * INSTRUCTOR, which has no account-management authority elsewhere
 * either).
 *
 * Analytics System Phase 3 — `segment` resolves a fixed or dynamic
 * "Interested in X" segment key (segments.ts) to a trainee-ID set and
 * ANDs it with the existing name/email/username search, reusing this
 * exact route/page rather than building a new one for segment browsing.
 * An unrecognized segment key returns zero results rather than
 * silently ignoring the filter.
 */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    // Training Organizations, Phase 2 — this list has no per-creator
    // scoping at all (every trainee on the platform, not just one
    // organization's own), unlike the course-content routes a
    // training-org-backed ADMIN session is meant to reuse. Not in that
    // session's nav at all (see ADMIN_NAV_TRAINING_ORG), so this is
    // defense-in-depth against the URL being hit directly — a 404, not
    // a 403, so it never confirms the route exists for a caller it
    // isn't meant for.
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const q = req.nextUrl.searchParams.get("q")?.trim();
    const segment = req.nextUrl.searchParams.get("segment")?.trim();

    const segmentTraineeIds = segment ? ((await resolveSegmentTraineeIds(segment)) ?? []) : null;

    const trainees = await prisma.trainee.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { username: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(segmentTraineeIds ? { id: { in: segmentTraineeIds } } : {}),
      },
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

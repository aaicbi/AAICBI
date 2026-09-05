import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";

/**
 * GET /api/courses/public-free — genuinely public, no authentication
 * at all. Built specifically for M24's optional course selector on the
 * registration form, which by definition runs before anyone has an
 * account or session — `courses/published` couldn't be reused here
 * since it requires `requireRole("TRAINEE")`, confirmed directly
 * before assuming otherwise.
 *
 * Deliberately narrower than `courses/published` too, not just
 * unauthenticated: free courses only (a paid one has nothing to offer
 * an anonymous visitor here — that flow doesn't exist until M26), and
 * a minimal field set (id, title, description) — no module counts or
 * anything else an authenticated trainee's browsing view gets. Least
 * exposure for a genuinely public, anonymous-reachable surface.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  return withApiErrors(async () => {
    const courses = await prisma.course.findMany({
      where: { published: true, isFree: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true },
    });
    return NextResponse.json(courses);
  });
}

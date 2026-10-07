import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

/**
 * GET /api/admin/trainees/[id] — a single trainee's full account and
 * profile detail for admin review (Phase 3's management console).
 * `[id]` here is legitimately the TARGET trainee's id, not the
 * caller's — the deliberately different shape from every self-edit
 * route in this app (see /api/trainee/profile), matching
 * /api/admin/employers/[id]/decide's own precedent for "admin acting
 * on someone else's account." Contact info (email/phone) IS included
 * here, unlike employer-facing discovery — admin account management
 * already has full access to this data via existing tools
 * (/admin/employers, /admin/staff both already show it), this isn't a
 * new exposure.
 *
 * Security audit finding — this had no guard at all, inconsistent
 * with the sibling list route (GET /api/admin/trainees), which already
 * blocks a training-org session outright since Trainee has no org FK
 * to scope by. Matched here for consistency — a training-org session
 * could previously reach any trainee's full profile by id even though
 * it could never discover that id via the (correctly blocked) list.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN");
    if (await findTrainingOrgByStaffUserId(session.userId)) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    const trainee = await prisma.trainee.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        username: true,
        location: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        currentEmploymentStatus: true,
        openToWork: true,
        resumeUrl: true,
        createdAt: true,
        emailVerified: true,
        publiclyDiscoverable: true,
        qaSuspendedAt: true,
        availabilityTypes: { select: { type: true } },
        skills: { select: { proficiency: true, skill: { select: { name: true } } } },
        education: { orderBy: { order: "asc" } },
        workExperiences: { orderBy: { order: "asc" } },
        projects: { orderBy: { order: "asc" } },
        certificates: {
          select: { code: true, issuedAt: true, revokedAt: true, course: { select: { title: true } } },
        },
        badges: { select: { threshold: true, awardedAt: true, course: { select: { title: true } } } },
        courseEnrollments: { select: { course: { select: { title: true } }, unlockedAt: true } },
      },
    });

    if (!trainee) {
      return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
    }

    return NextResponse.json({
      ...trainee,
      suspended: trainee.qaSuspendedAt !== null,
      availabilityTypes: trainee.availabilityTypes.map((a: { type: string }) => a.type),
      skills: trainee.skills.map((s: { proficiency: string; skill: { name: string } }) => ({
        name: s.skill.name,
        proficiency: s.proficiency,
      })),
    });
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { canViewProfile } from "@/lib/profileVisibility";

const NOT_FOUND = NextResponse.json({ error: "Profile not found." }, { status: 404 });

/**
 * GET /api/profile/u/[username] — the universal profile system's
 * Phase 4 authenticated-viewing surface, tier-enforced by
 * `profileVisibility`. Deliberately separate from `/profile/[code]`
 * (M37's anonymous, rate-limited, narrow-scope share link, left
 * completely untouched) — this is the richer profile (skills,
 * education, experience, projects, certificates, achievements)
 * reachable only by username, never by a link a trainee didn't choose
 * to make findable.
 *
 * "Doesn't exist" and "exists but you can't see it" return the exact
 * same 404 — the same non-oracle discipline `/profile/[code]` already
 * established, so a guessed username can't be used to confirm someone
 * has an account here at all, regardless of their visibility choice.
 *
 * Never selects email, phone, passwordHash, or any token field — same
 * "can't leak what was never fetched" discipline as
 * /api/employer/discover, applied at every tier, including the
 * owner's own view.
 */
export async function GET(_req: Request, { params }: { params: { username: string } }) {
  return withApiErrors(async () => {
    const viewer = await getSession();

    const trainee = await prisma.trainee.findUnique({
      where: { username: params.username },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        username: true,
        location: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        currentEmploymentStatus: true,
        openToWork: true,
        profileVisibility: true,
        availabilityTypes: { select: { type: true } },
        skills: { select: { proficiency: true, skill: { select: { name: true } } } },
        education: { orderBy: { order: "asc" } },
        workExperiences: { orderBy: { order: "asc" } },
        projects: { orderBy: { order: "asc" } },
        badges: { select: { threshold: true, course: { select: { title: true } } } },
        certificates: {
          where: { revokedAt: null },
          select: { code: true, course: { select: { title: true } } },
        },
      },
    });

    if (trainee) {
      const allowed = await canViewProfile(trainee.profileVisibility, trainee.id, "TRAINEE", viewer);
      if (!allowed) return NOT_FOUND;
      return NextResponse.json({
        type: "TRAINEE",
        name: trainee.name,
        avatarUrl: trainee.avatarUrl,
        username: trainee.username,
        location: trainee.location,
        linkedinUrl: trainee.linkedinUrl,
        githubUrl: trainee.githubUrl,
        portfolioUrl: trainee.portfolioUrl,
        currentEmploymentStatus: trainee.currentEmploymentStatus,
        openToWork: trainee.openToWork,
        availabilityTypes: trainee.availabilityTypes.map((a: { type: string }) => a.type),
        skills: trainee.skills.map((s: { proficiency: string; skill: { name: string } }) => ({
          name: s.skill.name,
          proficiency: s.proficiency,
        })),
        education: trainee.education,
        workExperiences: trainee.workExperiences,
        projects: trainee.projects,
        badges: trainee.badges,
        certificates: trainee.certificates.map((c: (typeof trainee.certificates)[number]) => ({
          code: c.code,
          courseTitle: c.course.title,
        })),
      });
    }

    const staff = await prisma.user.findUnique({
      where: { username: params.username },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        username: true,
        role: true,
        bio: true,
        jobTitle: true,
        department: true,
        areasOfResponsibility: true,
        profileVisibility: true,
      },
    });

    if (staff) {
      const allowed = await canViewProfile(staff.profileVisibility, staff.id, "STAFF", viewer);
      if (!allowed) return NOT_FOUND;
      return NextResponse.json({
        type: "STAFF",
        name: staff.name,
        avatarUrl: staff.avatarUrl,
        username: staff.username,
        role: staff.role,
        bio: staff.bio,
        jobTitle: staff.jobTitle,
        department: staff.department,
        areasOfResponsibility: staff.areasOfResponsibility,
      });
    }

    return NOT_FOUND;
  });
}

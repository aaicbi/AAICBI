import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateSchema = z.object({
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  companySize: z.string().trim().max(60).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  profileVisibility: z.enum(["PUBLIC", "AUTHENTICATED", "EMPLOYERS_ONLY", "PRIVATE"]),
});

/**
 * GET/PUT /api/employer/profile — the universal profile system's
 * company-profile fields (Phase 2). Deliberately separate from
 * /api/employer/settings (dark mode only, today) for the same reason
 * the trainee equivalents are split: distinct concerns get their own
 * route rather than one bulk PUT accumulating unrelated fields.
 * "Skills sought" and "active vacancies" are derived from this
 * employer's own JobPosting/JobPostingSkill rows on read, not stored
 * here — see the schema comment on Employer for why.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const employer = await prisma.employer.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
        companyName: true,
        logoUrl: true,
        industry: true,
        companySize: true,
        location: true,
        description: true,
        website: true,
        linkedinUrl: true,
        otherSocialUrl: true,
        approvalState: true,
        profileVisibility: true,
        jobPostings: {
          where: { status: "APPROVED" },
          select: {
            id: true,
            title: true,
            closingDate: true,
            skills: { select: { skill: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    const skillsSoughtMap = new Map<string, { id: string; name: string }>();
    for (const posting of employer.jobPostings) {
      for (const s of posting.skills) skillsSoughtMap.set(s.skill.id, s.skill);
    }

    return NextResponse.json({
      companyName: employer.companyName,
      logoUrl: employer.logoUrl,
      industry: employer.industry,
      companySize: employer.companySize,
      location: employer.location,
      description: employer.description,
      website: employer.website,
      linkedinUrl: employer.linkedinUrl,
      otherSocialUrl: employer.otherSocialUrl,
      approvalState: employer.approvalState,
      profileVisibility: employer.profileVisibility,
      activeVacancies: employer.jobPostings.map((p: (typeof employer.jobPostings)[number]) => ({
        id: p.id,
        title: p.title,
        closingDate: p.closingDate,
      })),
      skillsSought: Array.from(skillsSoughtMap.values()),
    });
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("EMPLOYER");
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await prisma.employer.update({
      where: { id: session.userId },
      data: {
        industry: parsed.data.industry || null,
        companySize: parsed.data.companySize || null,
        location: parsed.data.location || null,
        description: parsed.data.description || null,
        profileVisibility: parsed.data.profileVisibility,
      },
    });

    return NextResponse.json({ ok: true });
  });
}

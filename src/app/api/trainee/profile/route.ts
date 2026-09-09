import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { safeUrl } from "@/lib/materialUrl";

const AVAILABILITY_TYPES = ["INTERNSHIP", "FREELANCE", "FULL_TIME", "PART_TIME"] as const;
const EMPLOYMENT_STATUSES = ["STUDENT", "EMPLOYED", "UNEMPLOYED", "SELF_EMPLOYED"] as const;

const UpdateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Only letters, numbers, hyphens, and underscores.")
    .optional()
    .or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  linkedinUrl: safeUrl.optional().or(z.literal("")),
  githubUrl: safeUrl.optional().or(z.literal("")),
  portfolioUrl: safeUrl.optional().or(z.literal("")),
  currentEmploymentStatus: z.enum(EMPLOYMENT_STATUSES).nullable(),
  openToWork: z.boolean(),
  availabilityTypes: z.array(z.enum(AVAILABILITY_TYPES)),
  profileVisibility: z.enum(["PUBLIC", "AUTHENTICATED", "EMPLOYERS_ONLY", "PRIVATE"]),
});

/**
 * GET/PUT /api/trainee/profile — the core, self-edited scalar fields of
 * the new richer profile (Phase 1 of the universal profile system).
 * Deliberately its own route, not folded into the M14 general settings
 * PUT or M32's discoverability PUT — same reasoning both of those
 * establish: this is a distinct concern with its own shape. Skills,
 * education, work experience, and projects each have their own CRUD
 * routes rather than being nested here, matching this app's existing
 * discoverability-certificates precedent of a real join/child resource
 * getting its own endpoint rather than being smuggled into a bulk PUT.
 */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const trainee = await prisma.trainee.findUniqueOrThrow({
      where: { id: session.userId },
      select: {
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
        resumeUrl: true,
        resumeUploadedAt: true,
        availabilityTypes: { select: { type: true } },
      },
    });
    return NextResponse.json({
      name: trainee.name,
      avatarUrl: trainee.avatarUrl,
      username: trainee.username,
      location: trainee.location,
      linkedinUrl: trainee.linkedinUrl,
      githubUrl: trainee.githubUrl,
      portfolioUrl: trainee.portfolioUrl,
      currentEmploymentStatus: trainee.currentEmploymentStatus,
      openToWork: trainee.openToWork,
      profileVisibility: trainee.profileVisibility,
      resumeUrl: trainee.resumeUrl,
      resumeUploadedAt: trainee.resumeUploadedAt,
      availabilityTypes: trainee.availabilityTypes.map((a: { type: string }) => a.type),
    });
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const username = parsed.data.username || null;

    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.trainee.update({
          where: { id: session.userId },
          data: {
            username,
            location: parsed.data.location || null,
            linkedinUrl: parsed.data.linkedinUrl || null,
            githubUrl: parsed.data.githubUrl || null,
            portfolioUrl: parsed.data.portfolioUrl || null,
            currentEmploymentStatus: parsed.data.currentEmploymentStatus,
            openToWork: parsed.data.openToWork,
            profileVisibility: parsed.data.profileVisibility,
          },
        });
        // Replace the whole set — same "delete then recreate" approach
        // M32's discoverability PUT already uses for a small,
        // trainee-owned list where diffing wouldn't be worth it.
        await tx.traineeAvailabilityType.deleteMany({ where: { traineeId: session.userId } });
        if (parsed.data.availabilityTypes.length > 0) {
          await tx.traineeAvailabilityType.createMany({
            data: parsed.data.availabilityTypes.map((type: string) => ({ traineeId: session.userId, type })),
          });
        }
      });
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ ok: true });
  });
}

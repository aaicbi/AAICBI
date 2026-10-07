import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireTrainingOrgSession } from "@/lib/trainingOrgMembers";
import { SLUG_PATTERN, slugify } from "@/lib/ecosystem/educationPostCore";
import { safeUrl } from "@/lib/materialUrl";

const UpdateSchema = z.object({
  slug: z.string().trim().toLowerCase().min(3, "The page address needs at least 3 characters.").max(60).regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens.").optional(),
  tagline: z.string().trim().max(140).optional(),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).optional(),
  coverUrl: z.union([safeUrl, z.literal("")]).optional(),
  publicEnabled: z.boolean().optional(),
});

/**
 * GET/PUT /api/org/profile — the signed-in organization's own public
 * profile. The organization comes from the session on the server, never
 * from the request. `verified` is deliberately not writable here.
 */
export async function GET() {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const profile = await prisma.organizationPublicProfile.findUnique({ where: { trainingOrganizationId: org.id } });
    return NextResponse.json({
      organizationName: org.name,
      logoUrl: org.logoUrl,
      profile: profile ?? { slug: slugify(org.name), tagline: "", description: "", location: "", coverUrl: "", publicEnabled: false, verified: false },
      exists: !!profile,
    });
  });
}

export async function PUT(req: NextRequest) {
  return withApiErrors(async () => {
    const { org } = await requireTrainingOrgSession();
    const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    }
    const d = parsed.data;
    const existing = await prisma.organizationPublicProfile.findUnique({ where: { trainingOrganizationId: org.id } });
    const slug = d.slug ?? existing?.slug ?? slugify(org.name);

    const taken = await prisma.organizationPublicProfile.findUnique({ where: { slug }, select: { trainingOrganizationId: true } });
    if (taken && taken.trainingOrganizationId !== org.id) {
      return NextResponse.json({ error: "That page address is already taken. Try another." }, { status: 409 });
    }
    const data = {
      slug,
      ...(d.tagline !== undefined && { tagline: d.tagline || null }),
      ...(d.description !== undefined && { description: d.description || null }),
      ...(d.location !== undefined && { location: d.location || null }),
      ...(d.coverUrl !== undefined && { coverUrl: d.coverUrl || null }),
      ...(d.publicEnabled !== undefined && { publicEnabled: d.publicEnabled }),
    };
    // Only an approved organization may publish a public page.
    if (data.publicEnabled && org.approvalState !== "APPROVED") {
      return NextResponse.json({ error: "Your organization must be approved before its page can go public." }, { status: 403 });
    }
    const profile = await prisma.organizationPublicProfile.upsert({
      where: { trainingOrganizationId: org.id },
      create: { trainingOrganizationId: org.id, ...data },
      update: data,
    });
    return NextResponse.json({ profile });
  });
}

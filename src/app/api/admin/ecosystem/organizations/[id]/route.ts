import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { slugify } from "@/lib/ecosystem/educationPostCore";

const Body = z.object({ verified: z.boolean().optional(), publicEnabled: z.boolean().optional() });

/** PUT /api/admin/ecosystem/organizations/[id] — SUPER_ADMIN verifies an organization or switches its public page. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const org = await prisma.trainingOrganization.findUnique({ where: { id: params.id }, select: { id: true, name: true, approvalState: true } });
    if (!org || org.approvalState !== "APPROVED") return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    let slug = slugify(org.name);
    if (await prisma.organizationPublicProfile.findUnique({ where: { slug }, select: { id: true } })) slug = `${slug}-${org.id.slice(-4)}`;
    const profile = await prisma.organizationPublicProfile.upsert({
      where: { trainingOrganizationId: org.id },
      create: { trainingOrganizationId: org.id, slug, ...parsed.data },
      update: parsed.data,
      select: { slug: true, publicEnabled: true, verified: true },
    });
    return NextResponse.json({ profile });
  });
}

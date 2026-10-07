import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";

export const dynamic = "force-dynamic";

const Body = z.union([
  z.object({ type: z.literal("PROFILE_VIEW"), slug: z.string().min(1).max(80) }),
  z.object({ type: z.literal("PROGRAM_CLICK"), courseId: z.string().min(1).max(40), postId: z.string().min(1).max(40).optional() }),
]);

/**
 * POST /api/ecosystem/events — anonymous counters for the organization
 * dashboard. Stores only the type, organization and optional video or
 * program: no IP, account or free text. Rate-limited per caller and
 * target so a loop cannot inflate a number; unknown or non-public
 * targets are silently not counted.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ counted: false }, { status: 400 });
    if (!(await getEcosystemFlags()).orgPages) return NextResponse.json({ counted: false });

    const b = parsed.data;
    const target = b.type === "PROFILE_VIEW" ? b.slug : b.courseId;
    const limited = await rateLimit(`eco-event:${b.type}:${target}:${clientIp(req)}`, 1, 30 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ counted: false });

    const publicOrg = { approvalState: "APPROVED" as const, publicProfile: { is: { publicEnabled: true } } };
    if (b.type === "PROFILE_VIEW") {
      const org = await prisma.trainingOrganization.findFirst({ where: { ...publicOrg, publicProfile: { is: { publicEnabled: true, slug: b.slug } } }, select: { id: true } });
      if (!org) return NextResponse.json({ counted: false });
      await prisma.ecosystemEvent.create({ data: { type: "PROFILE_VIEW", trainingOrganizationId: org.id } });
      return NextResponse.json({ counted: true });
    }

    // Program click: the organization is whoever owns the course, never what the caller says.
    const course = await prisma.course.findUnique({ where: { id: b.courseId }, select: { id: true, createdById: true } });
    const org = course
      ? await prisma.trainingOrganization.findFirst({ where: { ...publicOrg, staffUserId: course.createdById }, select: { id: true } })
      : null;
    if (!course || !org) return NextResponse.json({ counted: false });
    const post = b.postId ? await prisma.educationPost.findFirst({ where: { id: b.postId, status: "PUBLISHED" }, select: { id: true } }) : null;
    await prisma.ecosystemEvent.create({ data: { type: "PROGRAM_CLICK", trainingOrganizationId: org.id, courseId: course.id, postId: post?.id ?? null } });
    return NextResponse.json({ counted: true });
  });
}

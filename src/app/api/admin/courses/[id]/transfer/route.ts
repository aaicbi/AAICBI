import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { transferCourse, TransferError } from "@/lib/courses/transfer";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Body = z.union([z.object({ organizationId: z.string().min(1) }), z.object({ toPlatform: z.literal(true) })]);

/**
 * POST { organizationId } moves the course (with its assessments, examination and assignments) to that training
 * organization; POST { toPlatform: true } brings it back to the signed-in super admin. SUPER_ADMIN only.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose an organization." }, { status: 400 });
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    try {
      const result = await transferCourse(params.id, "organizationId" in parsed.data ? { organizationId: parsed.data.organizationId } : { toPlatformUserId: session.userId }, { userId: session.userId, name: me?.name ?? "Super admin" });
      return NextResponse.json(result);
    } catch (e) {
      if (e instanceof TransferError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

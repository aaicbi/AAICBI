import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { isPaymentsTo } from "@/lib/courses/payments";

export const dynamic = "force-dynamic";

/**
 * PUT { paymentsTo: "OWNER" | "PLATFORM" } — a super admin decides whether new payments for this course follow its owner's
 * billing setup (an organization on revenue share receives its share) or stay entirely with AAICBI. Subscriptions already
 * running are not changed. Nobody else can change it, whoever owns the course.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const parsed = z.object({ paymentsTo: z.string().refine(isPaymentsTo) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose where new payments go." }, { status: 400 });
    const found = await prisma.course.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!found) return NextResponse.json({ error: "Course not found." }, { status: 404 });
    await prisma.course.update({ where: { id: params.id }, data: { paymentsTo: parsed.data.paymentsTo } });
    return NextResponse.json({ ok: true, paymentsTo: parsed.data.paymentsTo });
  });
}

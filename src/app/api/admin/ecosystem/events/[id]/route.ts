import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/admin/ecosystem/events/[id] — SUPER_ADMIN takes an event down (kept, not deleted). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const res = await prisma.organizationEvent.updateMany({ where: { id: params.id }, data: { status: "REMOVED" } });
    if (res.count === 0) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    return NextResponse.json({ removed: true });
  });
}

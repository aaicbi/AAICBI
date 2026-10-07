import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/admin/ecosystem/comments/[id] — SUPER_ADMIN hides a comment (kept, not deleted). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const res = await prisma.educationPostComment.updateMany({ where: { id: params.id }, data: { status: "HIDDEN" } });
    if (res.count === 0) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    return NextResponse.json({ hidden: true });
  });
}

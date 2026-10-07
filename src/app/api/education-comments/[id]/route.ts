import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** DELETE /api/education-comments/[id] — a trainee deletes their own comment; anyone else's is a 404. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE");
    const res = await prisma.educationPostComment.deleteMany({ where: { id: params.id, traineeId: session.userId } });
    if (res.count === 0) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
    return NextResponse.json({ deleted: true });
  });
}

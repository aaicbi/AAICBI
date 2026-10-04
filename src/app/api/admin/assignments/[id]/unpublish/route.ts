import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedAssignment(params.id, session.userId, session.role);
    const assignment = await prisma.assignment.update({ where: { id: params.id }, data: { status: "UNPUBLISHED" } });
    return NextResponse.json(assignment);
  });
}

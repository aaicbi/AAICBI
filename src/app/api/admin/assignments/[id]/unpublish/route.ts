import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedAssignment } from "@/lib/assignmentOwnership";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const owned = await requireOwnedAssignment(params.id, session.userId, session.role);
    if (session.role !== "SUPER_ADMIN" && owned.createdById !== session.userId) return NextResponse.json({ error: "Only the owner of this assignment can change whether it is published." }, { status: 403 });
    const assignment = await prisma.assignment.update({ where: { id: params.id }, data: { status: "UNPUBLISHED" } });
    return NextResponse.json(assignment);
  });
}

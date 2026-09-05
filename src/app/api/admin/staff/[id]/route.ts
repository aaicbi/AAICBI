import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const UpdateRoleSchema = z.object({ role: z.enum(["ADMIN", "INSTRUCTOR"]) });

/**
 * PATCH /api/admin/staff/[id] — change an existing staff member's
 * role. Same SUPER_ADMIN-only scoping and the same hard "never
 * SUPER_ADMIN" boundary as creation — see that route's own comment
 * for why. Deliberately does not let a Super Admin change their own
 * role through this route (a real, if narrow, self-lockout risk —
 * demoting the only Super Admin account this way could leave the
 * platform with no one able to use this page at all).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");

    if (params.id === session.userId) {
      return NextResponse.json({ error: "You can't change your own role here." }, { status: 400 });
    }

    const body = await req.json();
    const parsed = UpdateRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const staffMember = await prisma.user.findUnique({ where: { id: params.id } });
    if (!staffMember) {
      return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    }
    if (staffMember.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "A Super Admin's role can't be changed here." }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(updated);
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { withApiErrors } from "@/lib/apiError";

const UpdateSchema = z
  .object({
    role: z.enum(["ADMIN", "INSTRUCTOR"]).optional(),
    canReview: z.boolean().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    jobTitle: z.string().trim().max(80).optional(),
    staffNumber: z.string().trim().max(40).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to change.");

/**
 * PATCH /api/admin/staff/[id] — change an existing staff member's role, reviewer flag, name, designation, staff number, or switch the account
 * off or on. Each needs its own permission (role and reviewer: manage; details: edit; suspending: manage), and never applies to yourself or to a
 * Super Admin. Suspending takes effect on the person's very next request. Permissions themselves are set at `/api/admin/staff/[id]/access`.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const d = parsed.data;
    const needsManage = d.role !== undefined || d.canReview !== undefined || d.active !== undefined;
    const needsEdit = d.name !== undefined || d.jobTitle !== undefined || d.staffNumber !== undefined;
    const { session } = await requirePermission(needsManage ? "staff.accounts:manage" : "staff.accounts:edit");
    if (needsManage && needsEdit) await requirePermission("staff.accounts:edit");

    if (params.id === session.userId) return NextResponse.json({ error: "You can't change your own account here." }, { status: 400 });
    const staffMember = await prisma.user.findUnique({ where: { id: params.id } });
    if (!staffMember) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    if (staffMember.role === "SUPER_ADMIN") return NextResponse.json({ error: "A Super Admin account can't be changed here." }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(d.role !== undefined ? { role: d.role } : {}),
        ...(d.canReview !== undefined ? { canReview: d.canReview } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.jobTitle !== undefined ? { jobTitle: d.jobTitle || null } : {}),
        ...(d.staffNumber !== undefined ? { staffNumber: d.staffNumber || null } : {}),
        ...(d.active !== undefined ? { active: d.active } : {}),
      },
      select: { id: true, name: true, email: true, role: true, canReview: true, active: true, jobTitle: true, staffNumber: true },
    });
    if (d.active !== undefined && d.active !== staffMember.active) await recordAudit({ actorId: session.userId, actorRole: session.role, action: d.active ? "STAFF_REACTIVATED" : "STAFF_SUSPENDED", resourceType: "staff", resourceId: params.id });
    if (d.role !== undefined && d.role !== staffMember.role) await recordAudit({ actorId: session.userId, actorRole: session.role, action: "STAFF_ROLE_CHANGED", resourceType: "staff", resourceId: params.id, before: { role: staffMember.role }, after: { role: d.role } });
    if (d.canReview !== undefined && d.canReview !== staffMember.canReview) await recordAudit({ actorId: session.userId, actorRole: session.role, action: d.canReview ? "REVIEWER_GRANTED" : "REVIEWER_REVOKED", resourceType: "staff", resourceId: params.id });
    return NextResponse.json(updated);
  });
}

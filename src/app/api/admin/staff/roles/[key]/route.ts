import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { withApiErrors } from "@/lib/apiError";
import { cleanKeys } from "@/lib/rbac/catalogue";

const Body = z.object({ name: z.string().trim().min(2).max(60).optional(), description: z.string().trim().max(300).optional(), permissions: z.array(z.string()).max(400).optional() });

/** PUT — change a custom role. Everyone who has the role gets the change on their next request. */
export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("staff.roles:edit");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    const old = await prisma.staffRole.findUnique({ where: { key: params.key } });
    if (!old) return NextResponse.json({ error: "That role could not be found." }, { status: 404 });
    const permissions = parsed.data.permissions ? cleanKeys(parsed.data.permissions) : undefined;
    const role = await prisma.staffRole.update({ where: { key: params.key }, data: { ...(parsed.data.name ? { name: parsed.data.name } : {}), ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}), ...(permissions ? { permissions } : {}) }, select: { key: true, name: true, description: true, permissions: true } });
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "ROLE_CHANGED", resourceType: "role", resourceId: params.key, before: { permissions: old.permissions }, after: { permissions: role.permissions } });
    return NextResponse.json(role);
  });
}

/** DELETE — remove a custom role. Refused while anyone still has it. */
export async function DELETE(_req: NextRequest, { params }: { params: { key: string } }) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("staff.roles:edit");
    const inUse = await prisma.user.count({ where: { staffRoleKey: params.key } });
    if (inUse > 0) return NextResponse.json({ error: `${inUse} staff member${inUse === 1 ? " has" : "s have"} this role. Give them another role first.` }, { status: 409 });
    const r = await prisma.staffRole.deleteMany({ where: { key: params.key } });
    if (r.count === 0) return NextResponse.json({ error: "That role could not be found." }, { status: 404 });
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "ROLE_DELETED", resourceType: "role", resourceId: params.key });
    return NextResponse.json({ ok: true });
  });
}

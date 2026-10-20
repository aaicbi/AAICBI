import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { withApiErrors } from "@/lib/apiError";
import { cleanKeys } from "@/lib/rbac/catalogue";
import { ROLE_TEMPLATES } from "@/lib/rbac/templates";

export const dynamic = "force-dynamic";

/** GET — the saved custom roles (the eight built-in templates ship with the app). */
export async function GET() {
  return withApiErrors(async () => {
    await requirePermission("staff.roles:view");
    const roles = await prisma.staffRole.findMany({ orderBy: { name: "asc" }, select: { key: true, name: true, description: true, permissions: true } });
    return NextResponse.json({ roles }, { headers: { "Cache-Control": "no-store" } });
  });
}

const Body = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(300).optional(), permissions: z.array(z.string()).max(400) });

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

/** POST — save a new custom role built from the catalogue. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const { session } = await requirePermission("staff.roles:edit");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Give the role a name and choose its permissions." }, { status: 400 });
    const key = `role_${slug(parsed.data.name)}`;
    if (key === "role_" || ROLE_TEMPLATES.some((t) => t.key === key) || (await prisma.staffRole.findUnique({ where: { key } }))) return NextResponse.json({ error: "A role with that name already exists." }, { status: 409 });
    const permissions = cleanKeys(parsed.data.permissions);
    const role = await prisma.staffRole.create({ data: { key, name: parsed.data.name, description: parsed.data.description ?? "", permissions, createdById: session.userId }, select: { key: true, name: true, description: true, permissions: true } });
    await recordAudit({ actorId: session.userId, actorRole: session.role, action: "ROLE_CREATED", resourceType: "role", resourceId: key, after: { permissions } });
    return NextResponse.json(role, { status: 201 });
  });
}

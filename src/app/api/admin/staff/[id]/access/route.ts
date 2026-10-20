import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/rbac/guard";
import { withApiErrors } from "@/lib/apiError";
import { StaffAccessError, saveStaffAccess, staffDetail } from "@/lib/rbac/staff";

export const dynamic = "force-dynamic";

/** GET — one staff member with their role, overrides, effective permissions and the history of changes. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await requirePermission("staff.permissions:view");
    const d = await staffDetail(params.id);
    if (!d) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
    return NextResponse.json(d, { headers: { "Cache-Control": "no-store" } });
  });
}

const Body = z.object({ staffRoleKey: z.string().max(60).nullable(), grants: z.array(z.string()).max(400), denies: z.array(z.string()).max(400) });

/** PUT — set the role template and the permissions added to or taken from it. Only within the caller's own authority; recorded; applies at once. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { session, access } = await requirePermission("staff.permissions:assign_permissions");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      await saveStaffAccess({ id: session.userId, role: session.role, permissions: access.permissions }, params.id, parsed.data);
    } catch (e) {
      if (e instanceof StaffAccessError) return NextResponse.json({ error: e.message, denied: e.denied }, { status: e.status });
      throw e;
    }
    return NextResponse.json(await staffDetail(params.id), { headers: { "Cache-Control": "no-store" } });
  });
}

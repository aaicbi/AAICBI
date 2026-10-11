import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { REQUEST_STATUSES } from "@/lib/profiles/handleChangeCore";

export const dynamic = "force-dynamic";

/** GET /api/admin/handle-requests?status=PENDING|APPROVED|REJECTED|CANCELLED|ALL — SUPER_ADMIN reads handle change requests. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
    const rows = await prisma.handleChangeRequest.findMany({
      where: (REQUEST_STATUSES as string[]).includes(status) ? { status } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const profiles = await prisma.profile.findMany({ where: { id: { in: rows.map((r) => r.profileId) } }, select: { id: true, kind: true, handle: true } });
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return NextResponse.json({ requests: rows.map((r) => ({ ...r, kind: byId.get(r.profileId)?.kind ?? null, handleNow: byId.get(r.profileId)?.handle ?? null })) });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"];

/** GET /api/admin/startups?status=PENDING|APPROVED|... |ALL — SUPER_ADMIN reads startups for review. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
    const rows = await prisma.startup.findMany({ where: STATUSES.includes(status) ? { status: status as never } : {}, orderBy: { createdAt: "desc" }, take: 100, include: { members: { where: { status: "ACTIVE" }, select: { id: true, role: true } } } });
    const profiles = await prisma.profile.findMany({ where: { startupId: { in: rows.map((r) => r.id) } }, select: { startupId: true, handle: true } });
    const handle = new Map(profiles.map((p) => [p.startupId, p.handle]));
    return NextResponse.json({ startups: rows.map((r) => ({ id: r.id, name: r.name, tagline: r.tagline, problem: r.problem, solution: r.solution, industry: r.industry, stage: r.stage, status: r.status, verified: r.verified, reviewNote: r.reviewNote, submittedAt: r.submittedAt, createdAt: r.createdAt, handle: handle.get(r.id) ?? null, team: r.members.length })) });
  });
}

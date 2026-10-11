import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** The 50 most recent staff sign-in attempts, newest first. Super admin only. */
export async function GET() {
  return withApiErrors(async () => {
    await requireRole("SUPER_ADMIN");
    const rows = await prisma.staffSignInLog.findMany({ orderBy: { at: "desc" }, take: 50, select: { id: true, at: true, email: true, outcome: true, ip: true } });
    return NextResponse.json({ items: rows.map((r) => ({ ...r, at: r.at.toISOString() })) });
  });
}

import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { myStartups } from "@/lib/startups/startups";
import { memberSession } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** GET /api/startups/mine — the startups the member is on, and invitations waiting for an answer. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await memberSession();
    const rows = await myStartups(session.userId);
    return NextResponse.json({
      startups: rows.filter((r) => r.member.status === "ACTIVE").map((r) => ({ id: r.startup.id, name: r.startup.name, tagline: r.startup.tagline, status: r.startup.status, verified: r.startup.verified, logoUrl: r.startup.logoUrl, handle: r.handle, role: r.member.role, canEdit: r.member.canEdit, canPublish: r.member.canPublish, reviewNote: r.startup.reviewNote })),
      invitations: rows.filter((r) => r.member.status === "INVITED").map((r) => ({ memberId: r.member.id, startupName: r.startup.name, tagline: r.startup.tagline, title: r.member.title })),
    });
  });
}

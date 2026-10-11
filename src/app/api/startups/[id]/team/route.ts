import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { inviteMember, teamOf } from "@/lib/startups/startups";
import { memberSession, startupFailure } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** GET — the whole team, including invitations still waiting, for team members. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    try {
      return NextResponse.json({ team: await teamOf(params.id, session.userId) });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

/** POST { handle, title?, canEdit?, canPublish? } — a founder invites a member by handle. They join only if they accept. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const parsed = z.object({ handle: z.string().min(1).max(100), title: z.string().max(60).optional().nullable(), canEdit: z.boolean().optional(), canPublish: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter the member's handle." }, { status: 400 });
    try {
      await inviteMember(params.id, session.userId, parsed.data.handle, parsed.data);
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { removeMember, updateMember } from "@/lib/startups/startups";
import { memberSession, startupFailure } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** PATCH — a founder changes a member's permissions, title or role; anyone may choose whether they are shown publicly. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; memberId: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const parsed = z.object({ canEdit: z.boolean().optional(), canPublish: z.boolean().optional(), title: z.string().max(60).nullable().optional(), role: z.enum(["FOUNDER", "MEMBER"]).optional(), showOnProfile: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      await updateMember(params.id, session.userId, params.memberId, parsed.data);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

/** DELETE — a founder removes someone, or a person leaves. The last founder cannot leave. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string; memberId: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    try {
      await removeMember(params.id, session.userId, params.memberId);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

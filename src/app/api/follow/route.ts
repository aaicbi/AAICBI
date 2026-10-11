import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { follow, unfollow } from "@/lib/posts/interactions";
import { postFailure, requireActor } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

const Body = z.object({ profileId: z.string().min(1).max(40) });

/** POST { profileId } — follow a person, organization or startup. DELETE { profileId } — stop following. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose who to follow." }, { status: 400 });
    try { await follow(a.actor, parsed.data.profileId); return NextResponse.json({ ok: true }); } catch (e) { return postFailure(e); }
  });
}
export async function DELETE(req: NextRequest) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose who to unfollow." }, { status: 400 });
    try { await unfollow(a.actor, parsed.data.profileId); return NextResponse.json({ ok: true }); } catch (e) { return postFailure(e); }
  });
}

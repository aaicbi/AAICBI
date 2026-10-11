import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { setBookmark } from "@/lib/posts/interactions";
import { postFailure, requireActor } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** PUT — save the post. DELETE — unsave it. */
export async function PUT(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    try { await setBookmark(a.actor, params.id, true); return NextResponse.json({ ok: true }); } catch (e) { return postFailure(e); }
  });
}
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    try { await setBookmark(a.actor, params.id, false); return NextResponse.json({ ok: true }); } catch (e) { return postFailure(e); }
  });
}

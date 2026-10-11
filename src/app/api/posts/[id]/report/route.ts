import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { report } from "@/lib/posts/interactions";
import { postFailure, requireActor } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { reason, details?, commentId? } — report a post (or one of its comments) to the review team. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    try {
      await report(a.actor, params.id, await req.json().catch(() => null));
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
      return postFailure(e);
    }
  });
}

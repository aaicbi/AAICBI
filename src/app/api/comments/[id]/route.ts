import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { removeComment } from "@/lib/posts/interactions";
import { postFailure, requireActor } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** DELETE — remove a comment: its author, the post's own side, or a reviewer. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    try {
      await removeComment(a.actor, params.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

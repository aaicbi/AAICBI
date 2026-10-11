import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { actorOf, addComment, commentsFor } from "@/lib/posts/interactions";
import { getPostFor } from "@/lib/posts/posts";
import { postFailure, requireActor } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** GET — the comments on a post. Anyone who may see the post may read them, signed in or not. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await getSession();
    const found = await getPostFor(params.id, session);
    if (!found || found.post.status !== "PUBLISHED") return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json({ comments: await commentsFor(params.id, await actorOf(session)) });
  });
}

/** POST { body, parentId? } — comment, or reply one level deep. Needs an account. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    try {
      const id = await addComment(a.actor, params.id, await req.json().catch(() => null));
      return NextResponse.json({ id }, { status: 201 });
    } catch (e) {
      return postFailure(e);
    }
  });
}

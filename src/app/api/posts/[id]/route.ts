import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { deletePost, getPostFor, updatePost } from "@/lib/posts/posts";
import { PostInputSchema } from "@/lib/posts/postCore";
import { postFailure, signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** GET — one post, only if the signed-in person may see it (public rule, or it is theirs). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    const found = await getPostFor(params.id, s.session);
    if (!found) return NextResponse.json({ error: "Post not found." }, { status: 404 });
    return NextResponse.json(found);
  });
}

/** PUT — edit your post. A material edit to a published post sends it back for review. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    const parsed = PostInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the post and try again." }, { status: 400 });
    try {
      const post = await updatePost(s.session, params.id, parsed.data);
      return NextResponse.json({ id: post.id, status: post.status });
    } catch (e) {
      return postFailure(e);
    }
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    try {
      await deletePost(s.session, params.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

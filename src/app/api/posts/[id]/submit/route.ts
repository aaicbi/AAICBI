import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { submitPost } from "@/lib/posts/posts";
import { postFailure, signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST — send a draft (or a post that needed changes) for review. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    try {
      const post = await submitPost(s.session, params.id);
      return NextResponse.json({ id: post.id, status: post.status });
    } catch (e) {
      return postFailure(e);
    }
  });
}

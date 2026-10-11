import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { createPost } from "@/lib/posts/posts";
import { PostInputSchema } from "@/lib/posts/postCore";
import { postFailure, signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { identity, submit?, ...post } — write a post as yourself, a startup you publish for, or your organization. A draft stays private; submitting sends it for review. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    const body = await req.json().catch(() => null);
    const meta = z.object({ identity: z.string().min(1).max(100).default("self"), submit: z.boolean().default(false) }).safeParse(body ?? {});
    const parsed = PostInputSchema.safeParse(body ?? {});
    if (!meta.success || !parsed.success) return NextResponse.json({ error: (!parsed.success && parsed.error.issues[0]?.message) || "Check the post and try again." }, { status: 400 });
    try {
      const post = await createPost(s.session, meta.data.identity, parsed.data, meta.data.submit);
      return NextResponse.json({ id: post.id, status: post.status }, { status: 201 });
    } catch (e) {
      return postFailure(e);
    }
  });
}

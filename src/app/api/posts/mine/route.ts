import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { myPosts } from "@/lib/posts/posts";
import { signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** GET — the posts the signed-in person (and the startups or organization they publish for) wrote, with their review status. */
export async function GET() {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    return NextResponse.json({ posts: await myPosts(s.session) });
  });
}

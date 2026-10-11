import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { withdrawPost } from "@/lib/posts/posts";
import { postFailure, signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST — take a post back from review to edit it. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    try {
      await withdrawPost(s.session, params.id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

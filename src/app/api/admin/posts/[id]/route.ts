import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireReviewer } from "@/lib/review/access";
import { reviewPost } from "@/lib/posts/posts";
import { postFailure } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { action: approve|request_changes|reject|suspend|reinstate, note? } — a reviewer decides a post. Anything but approving needs a reason. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await requireReviewer();
    const parsed = z.object({ action: z.enum(["approve", "request_changes", "reject", "suspend", "reinstate"]), note: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      const post = await reviewPost(params.id, parsed.data.action, parsed.data.note?.trim() || null, actor);
      return NextResponse.json({ id: post.id, status: post.status });
    } catch (e) {
      return postFailure(e);
    }
  });
}

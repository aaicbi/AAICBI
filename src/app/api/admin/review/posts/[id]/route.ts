import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireReviewer } from "@/lib/review/access";
import { escalatePost, returnPost, reviewPost } from "@/lib/posts/posts";
import { postFailure } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { action, note? } — a reviewer decides a post (approve, request changes, reject, suspend, reinstate) or escalates it to the super admin. Anything but approving needs a reason. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await requireReviewer();
    const parsed = z.object({ action: z.enum(["approve", "request_changes", "reject", "suspend", "reinstate", "escalate", "return"]), note: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      const { action, note } = parsed.data;
      if (action === "escalate") await escalatePost(params.id, note, actor);
      else if (action === "return") await returnPost(params.id, actor);
      else await reviewPost(params.id, action, note?.trim() || null, actor);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

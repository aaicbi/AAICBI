import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireReviewer } from "@/lib/review/access";
import { decideAppeal, escalatePost, returnPost } from "@/lib/posts/posts";
import { postFailure } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { action: lift|uphold|escalate|return, note } — decide an author's appeal of an organization's hold: lift the hold, keep it, or escalate to the super admin. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await requireReviewer();
    const parsed = z.object({ action: z.enum(["lift", "uphold", "escalate", "return"]), note: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      const { action, note } = parsed.data;
      if (action === "escalate") await escalatePost(params.id, note, actor);
      else if (action === "return") await returnPost(params.id, actor);
      else await decideAppeal(params.id, action, note, actor);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

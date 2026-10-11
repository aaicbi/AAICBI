import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { requireReviewer } from "@/lib/review/access";
import { decideReport } from "@/lib/posts/interactions";
import { postFailure } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { action: dismiss|action|escalate|return, note } — decide a report: dismiss it, take the post down (or remove the comment), or escalate to a super admin. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await requireReviewer();
    const parsed = z.object({ action: z.enum(["dismiss", "action", "escalate", "return"]), note: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      await decideReport(params.id, parsed.data.action, parsed.data.note, actor);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

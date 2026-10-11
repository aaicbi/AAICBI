import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { appealBlock } from "@/lib/posts/posts";
import { postFailure, signedIn } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { note } — the author asks the central team to look again at an organization's hold on their post. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const s = await signedIn();
    if (s.error) return s.error;
    const parsed = z.object({ note: z.string().max(2000) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Tell us why the decision should be looked at again." }, { status: 400 });
    try {
      await appealBlock(s.session, params.id, parsed.data.note);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

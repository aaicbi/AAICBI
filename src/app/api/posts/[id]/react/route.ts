import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { setReaction } from "@/lib/posts/interactions";
import { REACTIONS } from "@/lib/posts/interactionCore";
import { postFailure, requireActor } from "@/lib/posts/http";

export const dynamic = "force-dynamic";

/** POST { kind: "LIKE" | "INSIGHTFUL" | "CELEBRATE" | "DISLIKE" | null } — set your one reaction on a post, or remove it with null. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const a = await requireActor();
    if (a.error) return a.error;
    const parsed = z.object({ kind: z.enum(REACTIONS).nullable() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a reaction." }, { status: 400 });
    try {
      await setReaction(a.actor, params.id, parsed.data.kind);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return postFailure(e);
    }
  });
}

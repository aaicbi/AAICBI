import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { actorOf, feedPage } from "@/lib/posts/interactions";
import { normalizeTag } from "@/lib/posts/interactionCore";

export const dynamic = "force-dynamic";

/** GET ?tab=latest|following&cursor=&tag= — a page of posts. Latest is open to everyone; Following needs an account. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await actorOf(await getSession());
    const tab = req.nextUrl.searchParams.get("tab") === "following" ? "following" : "latest";
    if (tab === "following" && !actor) return NextResponse.json({ error: "Sign in to see posts from people you follow." }, { status: 401 });
    const rawTag = req.nextUrl.searchParams.get("tag");
    const tag = rawTag ? normalizeTag(rawTag) : null;
    return NextResponse.json(await feedPage({ tab, actor, cursor: req.nextUrl.searchParams.get("cursor"), tag }));
  });
}

import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { featuredPlay } from "@/lib/growth/share";

export const dynamic = "force-dynamic";

/** GET ?src= — the funnel link the public About page offers, or {live:false} when no course link is live. Public, and nothing in it is private. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const f = await featuredPlay(req.nextUrl.searchParams.get("src"));
    return NextResponse.json(f ? { live: true, link: f.link, title: f.title } : { live: false }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } });
  });
}

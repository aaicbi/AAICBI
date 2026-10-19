import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { serveAds } from "@/lib/ads/ads";
import type { Placement } from "@/lib/ads/adsCore";

export const dynamic = "force-dynamic";

const PLACES: Record<string, Placement> = { top: "TOP", inline: "INLINE", about: "ABOUT" };

/** GET ?placement=top|inline|about&count=&exclude=a,b&src= — the live ads for a place on the site. Public; only what a visitor may see. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const q = req.nextUrl.searchParams;
    const placement = PLACES[q.get("placement") ?? ""];
    if (!placement) return NextResponse.json({ error: "Unknown place." }, { status: 400 });
    const count = Math.min(8, Math.max(1, Number(q.get("count")) || 1));
    const exclude = (q.get("exclude") ?? "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 20);
    const out = await serveAds({ placement, count, exclude, src: q.get("src") });
    return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
  });
}

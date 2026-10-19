import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { recordView } from "@/lib/ads/ads";
import { clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** POST — one person saw this ad. Counted only for a live ad, and capped per address per day. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const counted = await recordView(params.id.slice(0, 40), clientIp(req));
    return NextResponse.json({ counted }, { headers: { "Cache-Control": "no-store" } });
  });
}

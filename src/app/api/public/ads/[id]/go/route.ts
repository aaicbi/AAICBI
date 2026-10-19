import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { recordTap } from "@/lib/ads/ads";
import { clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** GET — counts the tap, then sends the visitor to the advertiser's own https link (only ever the link a Super Admin saved). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const url = await recordTap(params.id.slice(0, 40), clientIp(req));
    if (!url || !/^https:\/\//i.test(url)) return NextResponse.json({ error: "That ad could not be found." }, { status: 404 });
    return new NextResponse(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  });
}

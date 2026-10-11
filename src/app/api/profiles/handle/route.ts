import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { handleIsFree } from "@/lib/profiles/profiles";
import { validateHandle } from "@/lib/profiles/handleCore";

export const dynamic = "force-dynamic";

/** GET /api/profiles/handle?h=name — is this handle valid and free? Public, rate-limited; it only answers about handles, which are public anyway. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const limit = await rateLimit(`handle-check:${clientIp(req)}`, 60, 60 * 1000);
    if (!limit.allowed) return NextResponse.json({ error: "Too many checks. Wait a moment." }, { status: 429 });
    const v = validateHandle(req.nextUrl.searchParams.get("h") ?? "");
    if (!v.ok) return NextResponse.json({ available: false, error: v.error });
    return NextResponse.json({ available: await handleIsFree(v.handle), handle: v.handle });
  });
}

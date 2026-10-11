import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { previewLink } from "@/lib/collab/links";

export const dynamic = "force-dynamic";

/** GET ?token=… — what a link shares and whether it still works, before anyone signs in. Says nothing else. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const p = token.length >= 16 ? await previewLink(token) : null;
    if (!p) return NextResponse.json({ error: "This link is not valid." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(p, { headers: { "Cache-Control": "no-store" } });
  });
}

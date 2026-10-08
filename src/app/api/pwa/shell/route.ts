import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { shellForSession } from "@/lib/pwa/shell";

export const dynamic = "force-dynamic";

/** GET /api/pwa/shell — which bottom navigation the signed-in account gets (null when signed out). Navigation labels only; nothing personal. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await getSession().catch(() => null);
    const shell = session ? await shellForSession(session) : null;
    return NextResponse.json({ shell }, { headers: { "Cache-Control": "no-store" } });
  });
}

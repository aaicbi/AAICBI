import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { whoAmI } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

/** GET /api/guide/me — what kind of account is signed in (or null), so Loop can offer the right shortcuts. Never cached. */
export async function GET() {
  return withApiErrors(async () => NextResponse.json({ kind: await whoAmI() }, { headers: { "Cache-Control": "no-store" } }));
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { accessOf } from "@/lib/rbac/guard";

export const dynamic = "force-dynamic";

/** GET — what the signed-in person may do, for pages that decide what to show. Only ever describes the caller; the server checks again on every action. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ kind: "none", permissions: [] }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const access = await accessOf(session);
  return NextResponse.json({ kind: access.kind, permissions: [...access.permissions] }, { headers: { "Cache-Control": "no-store" } });
}

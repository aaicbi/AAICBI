import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { submitStartup } from "@/lib/startups/startups";
import { memberSession, startupFailure } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** POST — a founder sends the startup for review. It stays private until a super admin approves it. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    try {
      await submitStartup(params.id, session.userId);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

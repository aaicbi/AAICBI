import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { ChangeRequestError, createRequest, listRequests } from "@/lib/changeRequests/server";

export const dynamic = "force-dynamic";

/** GET: every change request. Super Admin only. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    return NextResponse.json({ requests: await listRequests(session), isSuper: session.role === "SUPER_ADMIN" });
  });
}

/** POST: write down a change you want made. It waits for approval. Super Admin only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const body = await req.json().catch(() => ({}));
    try {
      const created = await createRequest(session.userId, body ?? {});
      return NextResponse.json(created, { status: 201 });
    } catch (e) {
      if (e instanceof ChangeRequestError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { ChangeRequestError, createRequest, listRequests } from "@/lib/changeRequests/server";

/** GET: a Super Admin sees every change request; other staff see their own. */
export async function GET() {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    return NextResponse.json({ requests: await listRequests(session), isSuper: session.role === "SUPER_ADMIN" });
  });
}

/** POST: write down a change you want made. It waits for a Super Admin to approve it. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
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

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { ChangeRequestError, decideRequest } from "@/lib/changeRequests/server";

const Body = z.object({ status: z.enum(["PROPOSED", "APPROVED", "DONE", "DECLINED"]), note: z.string().max(1000).nullish(), prUrl: z.string().max(300).nullish() });

/** PATCH: approve, decline, mark done or reopen. Super Admin only: this is the approval Claude Code relies on. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose what to do with this request." }, { status: 400 });
    try {
      return NextResponse.json(await decideRequest(params.id, session.userId, parsed.data));
    } catch (e) {
      if (e instanceof ChangeRequestError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

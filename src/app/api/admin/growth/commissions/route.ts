import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { ReportError, moveCommission, settleCommissions } from "@/lib/growth/report";

export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settle"), ids: z.array(z.string().min(1).max(60)).max(500).optional(), organizationId: z.string().min(1).max(60).optional(), note: z.string().max(400).optional() }),
  z.object({ action: z.literal("reopen"), id: z.string().min(1).max(60) }),
  z.object({ action: z.literal("reverse"), id: z.string().min(1).max(60), note: z.string().max(400).optional() }),
]);

/** POST — mark commissions settled (some rows, or everything one organization owes), reopen a settled one, or reverse one after a refund. Super Admin only. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const s = await requireRole("SUPER_ADMIN");
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change wasn't understood." }, { status: 400 });
    try {
      const b = parsed.data;
      if (b.action === "settle") return NextResponse.json({ ok: true, settled: await settleCommissions(s.userId, { ids: b.ids, organizationId: b.organizationId, note: b.note }) });
      if (b.action === "reopen") await moveCommission(s.userId, b.id, "OWED");
      else await moveCommission(s.userId, b.id, "REVERSED", b.note);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

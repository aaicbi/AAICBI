import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { HandleChangeError, decideHandleRequest } from "@/lib/profiles/handleChanges";

export const dynamic = "force-dynamic";

/** POST { action: "approve" | "reject", note? } — SUPER_ADMIN decides a handle change request. A rejection must give a reason. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(1000).optional() }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } });
    try {
      await decideHandleRequest(params.id, parsed.data.action, parsed.data.note, { userId: session.userId, name: me?.name ?? "Super admin" });
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof HandleChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

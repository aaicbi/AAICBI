import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { HandleChangeError, directHandleChange } from "@/lib/profiles/handleChanges";

export const dynamic = "force-dynamic";

/** POST { profileId, handle, reason } — SUPER_ADMIN changes a handle directly (for organizations, and their own). The old handle is kept and forwards. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = z.object({ profileId: z.string().min(1).optional(), currentHandle: z.string().max(100).optional(), handle: z.string().max(100), reason: z.string().max(2000) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    let profileId = parsed.data.profileId;
    if (!profileId && parsed.data.currentHandle) {
      const found = await prisma.profile.findUnique({ where: { handle: parsed.data.currentHandle.trim().replace(/^@+/, "").toLowerCase() }, select: { id: true } });
      profileId = found?.id;
    }
    if (!profileId) return NextResponse.json({ error: "No profile has that current handle." }, { status: 404 });
    try {
      const handle = await directHandleChange(profileId, parsed.data.handle, parsed.data.reason, { userId: session.userId });
      return NextResponse.json({ ok: true, handle });
    } catch (e) {
      if (e instanceof HandleChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

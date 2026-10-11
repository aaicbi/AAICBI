import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { prisma } from "@/lib/prisma";
import { membershipOf, updateStartup } from "@/lib/startups/startups";
import { StartupInputSchema, can } from "@/lib/startups/startupCore";
import { memberSession, startupFailure } from "@/lib/startups/http";
import { ensureProfile } from "@/lib/profiles/profiles";

export const dynamic = "force-dynamic";

/** GET — a team member reads the startup with what they may do. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const m = await membershipOf(params.id, session.userId);
    if (!m || m.status !== "ACTIVE") return NextResponse.json({ error: "You are not on this startup's team." }, { status: 403 });
    const s = await prisma.startup.findUnique({ where: { id: params.id } });
    if (!s) return NextResponse.json({ error: "Startup not found." }, { status: 404 });
    const p = await ensureProfile("STARTUP", s.id);
    return NextResponse.json({ startup: s, handle: p?.handle ?? null, me: { role: m.role, canEdit: can(m, "edit"), canPublish: can(m, "publish"), canManageTeam: can(m, "manage_team"), canSubmit: can(m, "submit") } });
  });
}

/** PUT — a team member with permission edits the startup's profile. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const parsed = StartupInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details and try again." }, { status: 400 });
    try {
      await updateStartup(params.id, session.userId, parsed.data);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { HandleChangeError, cancelHandleRequest, myHandleState, profileForSession, requestHandleChange, startupProfileForFounder } from "@/lib/profiles/handleChanges";

export const dynamic = "force-dynamic";

async function mine(startupId?: string | null) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  // With a startup id, a founder speaks for the startup's profile instead of their own.
  if (startupId) {
    if (session.role !== "TRAINEE") return { error: NextResponse.json({ error: "Only a founder can do that." }, { status: 403 }) };
    try {
      return { profile: await startupProfileForFounder(startupId, session.userId) };
    } catch (e) {
      if (e instanceof HandleChangeError) return { error: NextResponse.json({ error: e.message }, { status: e.status }) };
      throw e;
    }
  }
  const profile = await profileForSession(session);
  if (!profile) return { error: NextResponse.json({ error: "This account cannot ask for a handle change here." }, { status: 403 }) };
  return { profile };
}

/** GET — the signed-in person's handle and their recent change requests. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const m = await mine(req.nextUrl.searchParams.get("startupId"));
    if (m.error) return m.error;
    return NextResponse.json(await myHandleState(m.profile));
  });
}

/** POST { handle, reason } — ask a super admin to change your handle. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const body = await req.json().catch(() => null);
    const m = await mine(typeof body?.startupId === "string" ? body.startupId : null);
    if (m.error) return m.error;
    const parsed = z.object({ handle: z.string().max(100), reason: z.string().max(2000) }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Enter the handle you want and your reason." }, { status: 400 });
    try {
      const row = await requestHandleChange(m.profile, parsed.data);
      return NextResponse.json({ id: row.id, status: row.status }, { status: 201 });
    } catch (e) {
      if (e instanceof HandleChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

/** DELETE ?id= — withdraw your waiting request. */
export async function DELETE(req: NextRequest) {
  return withApiErrors(async () => {
    const m = await mine(req.nextUrl.searchParams.get("startupId"));
    if (m.error) return m.error;
    const id = req.nextUrl.searchParams.get("id") ?? "";
    try {
      await cancelHandleRequest(m.profile, id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      if (e instanceof HandleChangeError) return NextResponse.json({ error: e.message }, { status: e.status });
      throw e;
    }
  });
}

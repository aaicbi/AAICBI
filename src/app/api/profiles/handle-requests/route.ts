import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { getSession } from "@/lib/auth/session";
import { HandleChangeError, cancelHandleRequest, myHandleState, profileForSession, requestHandleChange } from "@/lib/profiles/handleChanges";

export const dynamic = "force-dynamic";

async function mine() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Please sign in." }, { status: 401 }) };
  const profile = await profileForSession(session);
  if (!profile) return { error: NextResponse.json({ error: "This account cannot ask for a handle change here." }, { status: 403 }) };
  return { profile };
}

/** GET — the signed-in person's handle and their recent change requests. */
export async function GET() {
  return withApiErrors(async () => {
    const m = await mine();
    if (m.error) return m.error;
    return NextResponse.json(await myHandleState(m.profile));
  });
}

/** POST { handle, reason } — ask a super admin to change your handle. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const m = await mine();
    if (m.error) return m.error;
    const parsed = z.object({ handle: z.string().max(100), reason: z.string().max(2000) }).safeParse(await req.json().catch(() => null));
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
    const m = await mine();
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

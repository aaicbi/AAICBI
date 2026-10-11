import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { validateLogoFile, uploadLogo, deleteLogoBestEffort } from "@/lib/employerLogo";
import { membershipOf, setLogo } from "@/lib/startups/startups";
import { can } from "@/lib/startups/startupCore";
import { memberSession, startupFailure } from "@/lib/startups/http";

export const dynamic = "force-dynamic";

/** POST (file) — a team member with edit permission sets the startup logo. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    const m = await membershipOf(params.id, session.userId);
    if (!can(m, "edit")) return NextResponse.json({ error: "You do not have permission to change the logo." }, { status: 403 });
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    const bad = validateLogoFile(file);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    try {
      const url = await uploadLogo(file, `startup-${params.id}`);
      const old = await setLogo(params.id, session.userId, url);
      if (old) await deleteLogoBestEffort(old);
      return NextResponse.json({ logoUrl: url });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await memberSession();
    try {
      const old = await setLogo(params.id, session.userId, null);
      if (old) await deleteLogoBestEffort(old);
      return NextResponse.json({ logoUrl: null });
    } catch (e) {
      return startupFailure(e);
    }
  });
}

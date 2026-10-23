import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiErrors } from "@/lib/apiError";
import { getRegistration, requireCrm, updateRegistration } from "@/lib/crm/staff";
import { STAGES } from "@/lib/crm/registrationCore";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { access, canContacts } = await requireCrm("view");
    const r = await getRegistration(access, canContacts, params.id);
    return r ? NextResponse.json(r) : NextResponse.json({ error: "Registration not found." }, { status: 404 });
  });
}

const Patch = z.object({ stage: z.enum(STAGES).optional(), followUpAt: z.string().max(40).nullable().optional(), note: z.string().max(1000).optional() });

/** PATCH — change the stage, set or clear the follow-up date, or add a note. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const { session, access } = await requireCrm("manage");
    const parsed = Patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "That change was not understood." }, { status: 400 });
    const ok = await updateRegistration(access, session.userId, params.id, parsed.data);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Registration not found." }, { status: 404 });
  });
}

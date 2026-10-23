import { NextRequest, NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { composeOptions, requireCrmEmail } from "@/lib/crm/email";

export const dynamic = "force-dynamic";

/** GET ?registrationId= — what the composer needs: the person, their consent, the usable senders and templates, the writer's drafts. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const { session, access } = await requireCrmEmail("email", "create");
    const id = req.nextUrl.searchParams.get("registrationId") ?? "";
    const canSee = access.permissions.has(access.kind === "organization" ? "org_crm.contacts:view" : "crm.contacts:view");
    const out = await composeOptions(access, session.userId, id, canSee);
    return out ? NextResponse.json(out) : NextResponse.json({ error: "Registration not found." }, { status: 404 });
  });
}

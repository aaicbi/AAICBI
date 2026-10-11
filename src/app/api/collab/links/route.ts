import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { createLink, listSharing } from "@/lib/collab/links";
import { RESOURCE_TYPES } from "@/lib/collab/core";
import { collabFailure } from "../errors";

export const dynamic = "force-dynamic";

const Create = z.object({ type: z.enum(RESOURCE_TYPES as [string, ...string[]]), id: z.string().min(1), role: z.enum(["EDITOR", "COPY"]).default("EDITOR") });

/** GET ?type=COURSE&id=… — the links and collaborators of something you can edit. */
export async function GET(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const type = req.nextUrl.searchParams.get("type");
    const id = req.nextUrl.searchParams.get("id");
    if (!type || !id || !RESOURCE_TYPES.includes(type as never)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      return NextResponse.json(await listSharing(session, type as never, id));
    } catch (e) {
      return collabFailure(e);
    }
  });
}

/** POST { type, id, role } — makes a share link. The link is in the response once and is not stored in a readable form. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const parsed = Create.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    try {
      return NextResponse.json(await createLink(session, { type: parsed.data.type as never, id: parsed.data.id, role: parsed.data.role }), { status: 201 });
    } catch (e) {
      return collabFailure(e);
    }
  });
}

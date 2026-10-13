import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudioUser, requireStudioGame, requireStudioModule, requireStudioPermission } from "@/lib/quest/studioAccess";
import { withApiErrors } from "@/lib/apiError";
import { deleteItem, updateItem } from "@/lib/quest/studio";

const Patch = z.object({ content: z.unknown().optional(), status: z.enum(["DRAFT", "APPROVED", "REJECTED"]).optional() });

/** PATCH — approve or reject an item, or edit its content (an edited item goes back to draft). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; itemId: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "ITEMS");
    await requireStudioModule(params.id, session);
    const parsed = Patch.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    await updateItem(params.id, params.itemId, parsed.data, session.userId);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  return withApiErrors(async () => {
    const session = await requireStudioUser();
    requireStudioPermission(session, "ITEMS");
    await requireStudioModule(params.id, session);
    await deleteItem(params.id, params.itemId);
    return NextResponse.json({ deleted: true });
  });
}

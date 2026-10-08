import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { EntrySchema } from "@/lib/guide/adminSchemas";
import { guideActor, updateEntry } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

/** PUT /api/admin/guide/entries/[id] — SUPER_ADMIN edits, disables or enables an answer. The change is kept as a new version. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = EntrySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid answer." }, { status: 400 });
    const version = await prisma.$transaction((tx) => updateEntry(tx, params.id, parsed.data, actor));
    if (version === null) return NextResponse.json({ error: "Answer not found." }, { status: 404 });
    return NextResponse.json({ ok: true, version });
  });
}

/** DELETE /api/admin/guide/entries/[id] — SUPER_ADMIN removes an answer and its history. Disabling keeps the history; prefer that. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    await guideActor();
    const res = await prisma.guideEntry.deleteMany({ where: { id: params.id } });
    if (res.count === 0) return NextResponse.json({ error: "Answer not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}

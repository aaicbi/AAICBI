import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { EntrySchema } from "@/lib/guide/adminSchemas";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";
import { createEntry, guideActor } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

/** POST /api/admin/guide/entries — SUPER_ADMIN adds a written answer (saved as version 1). */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = EntrySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid answer." }, { status: 400 });
    if ((await prisma.guideEntry.count()) >= MAX_CUSTOM_ENTRIES) {
      return NextResponse.json({ error: `You can keep up to ${MAX_CUSTOM_ENTRIES} written answers. Remove one first.` }, { status: 409 });
    }
    const entry = await prisma.$transaction((tx) => createEntry(tx, parsed.data, actor));
    return NextResponse.json({ id: entry.id }, { status: 201 });
  });
}

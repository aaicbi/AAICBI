import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { guideActor, restoreVersion } from "@/lib/guide/knowledge";

export const dynamic = "force-dynamic";

/** POST /api/admin/guide/entries/[id]/restore — SUPER_ADMIN brings an older version back as a new version. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const actor = await guideActor();
    const parsed = z.object({ version: z.number().int().min(1) }).safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Choose a version." }, { status: 400 });
    const next = await prisma.$transaction((tx) => restoreVersion(tx, params.id, parsed.data.version, actor));
    if (next === null) return NextResponse.json({ error: "Version not found." }, { status: 404 });
    return NextResponse.json({ ok: true, version: next });
  });
}

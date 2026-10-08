import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiErrors } from "@/lib/apiError";
import { requireRole } from "@/lib/auth/session";
import { EntrySchema } from "@/lib/guide/adminSchemas";
import { MAX_CUSTOM_ENTRIES } from "@/lib/guide/server";

export const dynamic = "force-dynamic";

/** POST /api/admin/guide/entries — SUPER_ADMIN adds a written answer. */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN");
    const parsed = EntrySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid answer." }, { status: 400 });
    if ((await prisma.guideEntry.count()) >= MAX_CUSTOM_ENTRIES) {
      return NextResponse.json({ error: `You can keep up to ${MAX_CUSTOM_ENTRIES} written answers. Remove one first.` }, { status: 409 });
    }
    const d = parsed.data;
    const entry = await prisma.guideEntry.create({
      data: { question: d.question, answer: d.answer, links: d.links as Prisma.InputJsonValue, keywords: d.keywords, enabled: d.enabled, createdById: session.userId },
    });
    return NextResponse.json({ id: entry.id }, { status: 201 });
  });
}

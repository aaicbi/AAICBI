import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { requireOwnedLesson } from "@/lib/courseOwnership";
import { safeUrl, isAllowedVideoUrl } from "@/lib/materialUrl";

const CreateMaterialSchema = z
  .object({
    type: z.enum(["PDF", "DOCX", "PPTX", "VIDEO"]),
    title: z.string().min(2),
    url: safeUrl,
  })
  .refine((v) => v.type !== "VIDEO" || isAllowedVideoUrl(v.url), {
    message: "Video materials must be a YouTube or Google-hosted link (see the M40 video-hosting decision in the roadmap).",
    path: ["url"],
  });

/** POST /api/lessons/[id]/materials — attach a material to a lesson, ordered last. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    await requireOwnedLesson(params.id, session.userId);

    const body = await req.json();
    const parsed = CreateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Same reasoning as module/lesson creation: a transaction narrows the
    // order-assignment race window.
    // tx: any below is a sandbox-only workaround — prisma generate can't
    // run here (see README), so Prisma.TransactionClient isn't available
    // to infer from. A normal environment gets this typed automatically.
    const material = await prisma.$transaction(async (tx: any) => {
      const agg = await tx.material.aggregate({ where: { lessonId: params.id }, _max: { order: true } });
      return tx.material.create({
        data: {
          ...parsed.data,
          lessonId: params.id,
          order: (agg._max.order ?? -1) + 1,
        },
      });
    });
    return NextResponse.json(material, { status: 201 });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveActor } from "@/lib/messaging";

const BodySchema = z.object({
  blockedType: z.enum(["TRAINEE", "STAFF"]),
  blockedId: z.string().min(1),
});

/** POST /api/conversations/block — a personal, peer-level DM block.
 * Idempotent (upsert on the ordered pair). */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A blockedType and blockedId are required." }, { status: 400 });

    const me = await resolveActor(session);
    await prisma.block.upsert({
      where: {
        blockerType_blockerId_blockedType_blockedId: {
          blockerType: me.actorType,
          blockerId: me.actorId,
          blockedType: parsed.data.blockedType,
          blockedId: parsed.data.blockedId,
        },
      },
      create: { blockerType: me.actorType, blockerId: me.actorId, blockedType: parsed.data.blockedType, blockedId: parsed.data.blockedId },
      update: {},
    });

    return NextResponse.json({ ok: true });
  });
}

/** DELETE /api/conversations/block — unblock. */
export async function DELETE(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A blockedType and blockedId are required." }, { status: 400 });

    const me = await resolveActor(session);
    await prisma.block.deleteMany({
      where: { blockerType: me.actorType, blockerId: me.actorId, blockedType: parsed.data.blockedType, blockedId: parsed.data.blockedId },
    });

    return NextResponse.json({ ok: true });
  });
}

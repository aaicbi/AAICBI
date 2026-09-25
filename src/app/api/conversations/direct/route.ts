import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveActor, areCohortMates, canStaffReachTrainee, findOrCreateDirectConversation } from "@/lib/messaging";

const BodySchema = z.object({
  peerType: z.enum(["TRAINEE", "STAFF"]),
  peerId: z.string().min(1),
});

/**
 * POST /api/conversations/direct — find-or-create a DM. Trainee-to-
 * trainee requires a shared cohort; ADMIN/INSTRUCTOR-to-trainee requires
 * the trainee be reachable via a course this staff member owns;
 * SUPER_ADMIN and anyone messaging SUPER_ADMIN is unrestricted — see
 * messaging.ts's header comment for the full access-model reasoning.
 */
export async function POST(req: NextRequest) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINEE", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A peerType and peerId are required." }, { status: 400 });
    const { peerType, peerId } = parsed.data;

    const me = await resolveActor(session);
    if (me.actorType === peerType && me.actorId === peerId) {
      return NextResponse.json({ error: "You can't start a conversation with yourself." }, { status: 400 });
    }

    if (peerType === "TRAINEE") {
      const peer = await prisma.trainee.findUnique({ where: { id: peerId }, select: { id: true } });
      if (!peer) return NextResponse.json({ error: "Trainee not found." }, { status: 404 });

      if (me.actorType === "TRAINEE") {
        const mates = await areCohortMates(me.actorId, peerId);
        if (!mates) return NextResponse.json({ error: "You can only message trainees in your cohort." }, { status: 403 });
      } else {
        const reachable = await canStaffReachTrainee(session, peerId);
        if (!reachable) return NextResponse.json({ error: "This trainee isn't in a cohort you have access to." }, { status: 403 });
      }
    } else {
      const peer = await prisma.user.findUnique({ where: { id: peerId }, select: { id: true, role: true } });
      if (!peer) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

      // A trainee reaching a non-SUPER_ADMIN staff member must be
      // reachable the other way round too — the staff member must own
      // a course this trainee is cohort-enrolled in (or the peer is
      // SUPER_ADMIN, who's universally reachable).
      if (me.actorType === "TRAINEE" && peer.role !== "SUPER_ADMIN") {
        const reachable = await prisma.enrollmentRecord.findFirst({
          where: { traineeId: me.actorId, cohort: { course: { createdById: peerId } } },
          select: { id: true },
        });
        if (!reachable) return NextResponse.json({ error: "You can only message staff who teach one of your courses." }, { status: 403 });
      }
    }

    const conversation = await findOrCreateDirectConversation({ type: me.actorType, id: me.actorId }, { type: peerType, id: peerId });
    return NextResponse.json({ id: conversation.id });
  });
}

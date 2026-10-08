import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { resolveActor, areCohortMates, canStaffReachTrainee, findOrCreateDirectConversation, employerTraineeFacts } from "@/lib/messaging";
import { employerPairVerdict, traineeToEmployerVerdict } from "@/lib/messaging/policy";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";

const BodySchema = z.object({
  peerType: z.enum(["TRAINEE", "STAFF", "EMPLOYER"]),
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
    const session = await requireRole("TRAINEE", "EMPLOYER", "SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "A peerType and peerId are required." }, { status: 400 });
    const { peerType, peerId } = parsed.data;

    const me = await resolveActor(session);
    if (me.actorType === peerType && me.actorId === peerId) {
      return NextResponse.json({ error: "You can't start a conversation with yourself." }, { status: 400 });
    }

    if (me.actorType === "EMPLOYER") {
      // The employer side: trainees who engaged (accepted introduction or application), and Super Admins for support.
      if (peerType === "TRAINEE") {
        const peer = await prisma.trainee.findUnique({ where: { id: peerId }, select: { id: true } });
        if (!peer) return NextResponse.json({ error: "Trainee not found." }, { status: 404 });
        const verdict = employerPairVerdict("TRAINEE", await employerTraineeFacts(me.actorId, peerId));
        if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 403 });
      } else if (peerType === "STAFF") {
        const peer = await prisma.user.findUnique({ where: { id: peerId }, select: { role: true } });
        if (!peer) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });
        const verdict = employerPairVerdict("STAFF", { staffIsSuperAdmin: peer.role === "SUPER_ADMIN" });
        if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 403 });
      } else {
        return NextResponse.json({ error: "Employers can't message each other here." }, { status: 403 });
      }
    } else if (peerType === "EMPLOYER") {
      // Someone reaching an employer: a trainee who engaged with them, or a Super Admin. Nobody else.
      const peer = await prisma.employer.findUnique({ where: { id: peerId }, select: { id: true } });
      if (!peer) return NextResponse.json({ error: "Employer not found." }, { status: 404 });
      if (me.actorType === "TRAINEE") {
        const verdict = traineeToEmployerVerdict(await employerTraineeFacts(peerId, me.actorId));
        if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 403 });
      } else if (session.role !== "SUPER_ADMIN") {
        return NextResponse.json({ error: "You can't start a conversation with an employer." }, { status: 403 });
      }
    } else if (peerType === "TRAINEE") {
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

      // Security audit finding — a STAFF session (ADMIN/INSTRUCTOR,
      // including a training organization's own shadow account)
      // messaging another STAFF member had NO reachability check at
      // all: it could open a DM with any User id on the platform by
      // guessing/enumerating one. SUPER_ADMIN stays universally
      // reachable either direction (matches this route's own doc
      // comment); a training-org session on either end of the pair is
      // blocked — a shadow account exists only to hold
      // Course.createdById, never as a real messaging participant.
      if (me.actorType !== "TRAINEE" && peer.role !== "SUPER_ADMIN") {
        const meIsTrainingOrg = await findTrainingOrgByStaffUserId(me.actorId);
        const peerIsTrainingOrg = peer.role === "ADMIN" ? await findTrainingOrgByStaffUserId(peer.id) : null;
        if (meIsTrainingOrg || peerIsTrainingOrg) {
          return NextResponse.json({ error: "You can only message a Super Admin directly." }, { status: 403 });
        }
      }
    }

    const conversation = await findOrCreateDirectConversation({ type: me.actorType, id: me.actorId }, { type: peerType, id: peerId });
    return NextResponse.json({ id: conversation.id });
  });
}

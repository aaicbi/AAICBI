import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";
import { findOrCreateDirectConversation } from "@/lib/messaging";
import { notifyFounderOfNeedsRevision, notifyFounderOfApproval, notifyFounderOfRejection } from "@/lib/pitchNotify";

const DecideSchema = z
  .object({
    decision: z.enum(["APPROVE", "NEEDS_REVISION", "REJECT"]),
    reasonCategory: z.string().trim().max(160).optional(),
    note: z.string().trim().max(2000).optional(),
    cohortId: z.string().optional(),
    technicalScore: z.number().int().min(1).max(5).optional(),
    businessScore: z.number().int().min(1).max(5).optional(),
    marketScore: z.number().int().min(1).max(5).optional(),
    pitchQualityScore: z.number().int().min(1).max(5).optional(),
    documentationScore: z.number().int().min(1).max(5).optional(),
  })
  .refine((d) => d.decision === "APPROVE" || (!!d.reasonCategory && !!d.note), {
    message: "A reason category and note are required for this decision.",
    path: ["note"],
  });

/**
 * POST /api/admin/pitches/[id]/decide — the one review decision Phase 1
 * needs (no separate PitchReview table — see the schema's own comment).
 * NEEDS_REVISION is the one branch with a real side effect beyond the
 * row itself: it opens (or reuses) a real 1:1 conversation between the
 * reviewing staff member and the founder via the existing messaging
 * primitive, and seeds it with the note, rather than leaving the
 * founder to guess what to fix from a bare status change.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");

    const pitch = await prisma.pitchSubmission.findUnique({ where: { id: params.id } });
    if (!pitch) {
      return NextResponse.json({ error: "Pitch not found." }, { status: 404 });
    }
    if (pitch.status !== "SUBMITTED") {
      return NextResponse.json({ error: "This pitch isn't awaiting a decision." }, { status: 409 });
    }

    const body = await req.json();
    const parsed = DecideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const scoreData = {
      technicalScore: d.technicalScore,
      businessScore: d.businessScore,
      marketScore: d.marketScore,
      pitchQualityScore: d.pitchQualityScore,
      documentationScore: d.documentationScore,
    };

    if (d.decision === "APPROVE") {
      const updated = await prisma.pitchSubmission.update({
        where: { id: params.id },
        data: {
          status: "APPROVED",
          cohortId: d.cohortId || pitch.cohortId,
          reviewedById: session.userId,
          reviewedAt: new Date(),
          rejectionReasonCategory: null,
          rejectionNote: null,
          ...scoreData,
        },
      });
      await notifyFounderOfApproval(updated.id, updated.traineeId, updated.startupName);
      return NextResponse.json(updated);
    }

    if (d.decision === "REJECT") {
      const updated = await prisma.pitchSubmission.update({
        where: { id: params.id },
        data: {
          status: "REJECTED",
          reviewedById: session.userId,
          reviewedAt: new Date(),
          rejectionReasonCategory: d.reasonCategory,
          rejectionNote: d.note,
          ...scoreData,
        },
      });
      await notifyFounderOfRejection(updated.id, updated.traineeId, updated.startupName, d.note!);
      return NextResponse.json(updated);
    }

    // NEEDS_REVISION
    const updated = await prisma.pitchSubmission.update({
      where: { id: params.id },
      data: {
        status: "NEEDS_REVISION",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        rejectionReasonCategory: d.reasonCategory,
        rejectionNote: d.note,
        ...scoreData,
      },
    });

    const conversation = await findOrCreateDirectConversation(
      { type: "STAFF", id: session.userId },
      { type: "TRAINEE", id: pitch.traineeId }
    );
    await prisma.$transaction([
      prisma.conversationMessage.create({
        data: { conversationId: conversation.id, authorType: "STAFF", authorId: session.userId, body: d.note! },
      }),
      prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } }),
      prisma.conversationParticipant.upsert({
        where: {
          conversationId_participantType_participantId: {
            conversationId: conversation.id,
            participantType: "STAFF",
            participantId: session.userId,
          },
        },
        create: { conversationId: conversation.id, participantType: "STAFF", participantId: session.userId, lastReadAt: new Date() },
        update: { lastReadAt: new Date() },
      }),
    ]);

    await notifyFounderOfNeedsRevision(updated.id, updated.traineeId, updated.startupName, d.note!, "/trainee/messages");

    return NextResponse.json(updated);
  });
}

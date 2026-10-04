import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApiErrors } from "@/lib/apiError";

const AssignSchema = z.object({ certificateTemplateId: z.string().nullable() });

/**
 * PATCH /api/org/courses/[id] — the one real self-service action
 * Phase 1 grants: the org admin picks which of their own approved
 * templates applies to this course, themselves (confirmed explicitly
 * during planning). Ownership checked both ways — the course must be
 * this org's own (via the shadow staff account), and if a template id
 * is given, it must belong to this same org and already be approved —
 * a non-oracle 404 either way, never a 403 that would confirm a
 * course/template id exists but belongs to someone else.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withApiErrors(async () => {
    const session = await requireRole("TRAINING_ORG");
    const org = await prisma.trainingOrganization.findUnique({
      where: { id: session.userId },
      select: { id: true, staffUserId: true },
    });
    if (!org?.staffUserId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const course = await prisma.course.findUnique({ where: { id: params.id } });
    if (!course || course.createdById !== org.staffUserId) {
      return NextResponse.json({ error: "Course not found." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (parsed.data.certificateTemplateId) {
      const template = await prisma.certificateTemplate.findUnique({ where: { id: parsed.data.certificateTemplateId } });
      if (!template || template.trainingOrganizationId !== org.id || !template.approvedAt) {
        return NextResponse.json({ error: "Certificate template not found." }, { status: 404 });
      }
    }

    const updated = await prisma.course.update({
      where: { id: params.id },
      data: { certificateTemplateId: parsed.data.certificateTemplateId },
    });
    return NextResponse.json(updated);
  });
}

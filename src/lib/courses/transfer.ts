import { prisma } from "@/lib/prisma";
import { notifyByEmail } from "@/lib/notifications/log";
import { simpleNoticeEmail } from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";
import type { PaymentsTo } from "@/lib/courses/payments";

export class TransferError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface TransferResult {
  courseId: string;
  title: string;
  to: { kind: "organization"; id: string; name: string } | { kind: "platform"; name: string };
  exams: number;
  assignments: number;
  certificateTemplateCleared: boolean;
  paid: boolean;
  paymentsTo: PaymentsTo;
}

/**
 * Hands a course over to a training organization, or back to AAICBI.
 *
 * Ownership in this platform is `createdById`: a training organization acts as one dedicated staff user (its team all sign
 * in as that user), so giving a course to an organization means setting that user as the owner. Everything that is owned
 * through the course moves with it so the organization can really edit it: the module assessments and the course
 * examination, and the assignments. Trainees' enrolments, results and certificates stay exactly as they are (they hang off
 * the course, which keeps its id). The certificate template is cleared when it belonged to someone else, because templates are
 * per organization; the new owner picks one of theirs.
 *
 * Only a super admin calls this. Moving a paid course changes who new payments go to (the new owner's billing setup),
 * not subscriptions already running, so the result says whether the course is paid and the caller shows that.
 */
export async function transferCourse(courseId: string, target: { organizationId: string; paymentsTo?: PaymentsTo } | { toPlatformUserId: string }, actor: { userId: string; name: string }): Promise<TransferResult> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true, createdById: true, isFree: true, certificateTemplateId: true } });
  if (!course) throw new TransferError("Course not found.", 404);

  let newOwnerId: string;
  let to: TransferResult["to"];
  let org: { id: string; name: string; email: string } | null = null;
  if ("organizationId" in target) {
    const o = await prisma.trainingOrganization.findUnique({ where: { id: target.organizationId }, select: { id: true, name: true, email: true, staffUserId: true, approvalState: true } });
    if (!o) throw new TransferError("Organization not found.", 404);
    if (o.approvalState !== "APPROVED" || !o.staffUserId) throw new TransferError("That organization is not approved yet, so it cannot receive a course.", 409);
    newOwnerId = o.staffUserId;
    org = { id: o.id, name: o.name, email: o.email };
    to = { kind: "organization", id: o.id, name: o.name };
  } else {
    const u = await prisma.user.findUnique({ where: { id: target.toPlatformUserId }, select: { id: true, role: true, active: true } });
    if (!u || !u.active || u.role !== "SUPER_ADMIN") throw new TransferError("A course can only go back to a super admin.", 409);
    const isOrgUser = await prisma.trainingOrganization.findFirst({ where: { staffUserId: u.id }, select: { id: true } });
    if (isOrgUser) throw new TransferError("That account belongs to an organization.", 409);
    newOwnerId = u.id;
    to = { kind: "platform", name: "AAICBI" };
  }
  if (course.createdById === newOwnerId) throw new TransferError("That is already who owns this course.", 409);
  // Where new payments go is a super admin's decision, never a side effect of the move.
  if (org && !course.isFree && !("paymentsTo" in target && target.paymentsTo)) throw new TransferError("This is a paid course: choose where new payments go before moving it.", 400);
  const paymentsTo: PaymentsTo = org && "paymentsTo" in target && target.paymentsTo ? target.paymentsTo : "OWNER";

  const result = await prisma.$transaction(async (tx) => {
    const exams = await tx.exam.updateMany({ where: { OR: [{ courseId: course.id }, { courseModule: { courseId: course.id } }] }, data: { createdById: newOwnerId } });
    const assignments = await tx.assignment.updateMany({ where: { OR: [{ courseId: course.id }, { module: { courseId: course.id } }] }, data: { createdById: newOwnerId } });
    let certificateTemplateCleared = false;
    let clearTemplate = false;
    if (course.certificateTemplateId) {
      const tpl = await tx.certificateTemplate.findUnique({ where: { id: course.certificateTemplateId }, select: { trainingOrganizationId: true } });
      clearTemplate = !org || tpl?.trainingOrganizationId !== org.id;
      certificateTemplateCleared = clearTemplate;
    }
    await tx.course.update({ where: { id: course.id }, data: { createdById: newOwnerId, paymentsTo, ...(clearTemplate ? { certificateTemplateId: null } : {}) } });
    return { exams: exams.count, assignments: assignments.count, certificateTemplateCleared };
  });

  if (org) {
    try {
      const content = simpleNoticeEmail({ subject: `A course was added to your organization: ${course.title}`, paragraphs: [`AAICBI moved the course "${course.title}" to ${org.name}. You can now edit it, its assessments and examinations, and it shows under your organization.`], buttonLabel: "Open your courses", url: appUrl("/admin/courses") });
      await notifyByEmail({ recipientType: "TRAINING_ORG", recipientId: org.id, to: org.email, type: "COURSE_INSTRUCTOR_ASSIGNED", relatedId: course.id, url: "/admin/courses", ...content });
    } catch (e) {
      console.error("Could not notify an organization of a course transfer:", e instanceof Error ? e.message : e);
    }
  }
  console.info(`Course ${course.id} moved to ${to.kind === "organization" ? `organization ${to.id}` : "the platform"} by ${actor.userId}`);
  return { courseId: course.id, title: course.title, to, ...result, paid: !course.isFree, paymentsTo };
}

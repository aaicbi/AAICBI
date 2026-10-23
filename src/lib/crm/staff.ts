import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { PermissionError, accessOf, type Access } from "@/lib/rbac/guard";
import { recordAudit } from "@/lib/rbac/audit";
import { toCsv } from "@/lib/reports/performanceCore";
import { STAGES, SOURCE_LABEL, STAGE_LABEL, type Source, type Stage } from "@/lib/crm/registrationCore";

export type CrmAction = "view" | "manage" | "export";

/** The permission that governs an action: staff and Super Admins hold `crm.*`, a training organization holds `org_crm.*`. */
export const crmKey = (access: Access, action: CrmAction, feature: "registrations" | "contacts" = "registrations"): string =>
  `${access.kind === "organization" ? "org_crm" : "crm"}.${feature}:${action === "view" || feature === "contacts" ? "view" : action}`;

/**
 * Signs the person in, works out what they may do, and refuses (and records the attempt) unless they hold the permission. The CRM is
 * always scoped by `scope()`: a Super Admin sees every registration, staff see AAICBI's own, an organization sees only its own.
 */
export async function requireCrm(action: CrmAction) {
  const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  const access = await accessOf(session);
  const key = crmKey(access, action);
  if (!access.permissions.has(key)) {
    await recordAudit({ actorId: session.userId, actorRole: access.kind === "organization" ? "ORGANIZATION" : session.role, action: "ACCESS_DENIED", resourceType: "permission", resourceId: key, organizationId: access.organizationId, outcome: "DENIED" });
    throw new PermissionError(key);
  }
  return { session, access, canContacts: access.permissions.has(crmKey(access, "view", "contacts")) };
}

/** Which registrations this person may ever see. */
export function scope(access: Access): Prisma.CourseRegistrationWhereInput {
  if (access.kind === "super") return {};
  if (access.kind === "organization") return { organizationId: access.organizationId ?? "none" };
  return { organizationId: null };
}

export interface ListFilters {
  q?: string;
  courseId?: string;
  stage?: string;
  source?: string;
  needsFollowUp?: boolean;
  page?: number;
}
const PAGE = 25;

const rowSelect = {
  id: true, reference: true, stage: true, source: true, sourceTag: true, createdAt: true, followUpAt: true, followUpEmail: true, followUpWhatsapp: true,
  newsletter: true, organizationId: true,
  agreement: { select: { version: true } }, signedAt: true,
  course: { select: { id: true, title: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, optedOutAt: true } },
} satisfies Prisma.CourseRegistrationSelect;

function whereFrom(access: Access, f: ListFilters): Prisma.CourseRegistrationWhereInput {
  const and: Prisma.CourseRegistrationWhereInput[] = [scope(access)];
  if (f.courseId) and.push({ courseId: f.courseId });
  if ((STAGES as readonly string[]).includes(f.stage ?? "")) and.push({ stage: f.stage });
  if (f.source && f.source in SOURCE_LABEL) and.push({ source: f.source });
  if (f.needsFollowUp) and.push({ stage: { in: ["REGISTERED", "CONTACTED", "INTERESTED"] }, OR: [{ followUpAt: null }, { followUpAt: { lte: new Date() } }], contact: { optedOutAt: null } });
  const q = f.q?.trim();
  if (q) and.push({ OR: [{ reference: { contains: q, mode: "insensitive" } }, { contact: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } }] });
  return { AND: and };
}

const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2");

export async function listRegistrations(access: Access, canContacts: boolean, f: ListFilters) {
  const where = whereFrom(access, f);
  const page = Math.max(1, f.page ?? 1);
  const [rows, total, courses, newCount, dueCount] = await Promise.all([
    prisma.courseRegistration.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE, select: rowSelect }),
    prisma.courseRegistration.count({ where }),
    prisma.course.findMany({ where: { registrations: { some: scope(access) } }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 100 }),
    prisma.courseRegistration.count({ where: { AND: [scope(access), { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } }] } }),
    prisma.courseRegistration.count({ where: whereFrom(access, { needsFollowUp: true }) }),
  ]);
  return {
    total, page, pageSize: PAGE, courses, summary: { new7: newCount, needFollowUp: dueCount },
    rows: rows.map((r) => ({
      id: r.id, reference: r.reference, stage: r.stage as Stage, source: r.source as Source, sourceTag: r.sourceTag, createdAt: r.createdAt.toISOString(),
      followUpAt: r.followUpAt?.toISOString() ?? null, course: r.course,
      name: `${r.contact.firstName} ${r.contact.lastName}`,
      email: canContacts ? r.contact.email : maskEmail(r.contact.email), phone: canContacts ? r.contact.phone : null,
      emailOk: r.followUpEmail && !r.contact.optedOutAt, whatsappOk: r.followUpWhatsapp && !r.contact.optedOutAt, newsletter: r.newsletter && !r.contact.optedOutAt,
      optedOut: !!r.contact.optedOutAt, agreementVersion: r.agreement.version, signedAt: r.signedAt.toISOString(),
    })),
  };
}

export async function getRegistration(access: Access, canContacts: boolean, id: string, canSeeEmails = false) {
  const r = await prisma.courseRegistration.findFirst({
    where: { AND: [scope(access), { id }] },
    select: {
      ...rowSelect, motivation: true, signedName: true, lastContactedAt: true,
      contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, country: true, state: true, optedOutAt: true, emailSuppressedAt: true, relationships: true, traineeId: true } },
    },
  });
  if (!r) return null;
  const [activities, tasks, consents, others, emails] = await Promise.all([
    prisma.crmActivity.findMany({ where: { contactId: r.contact.id }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, kind: true, summary: true, createdAt: true, registrationId: true } }),
    prisma.crmTask.findMany({ where: { contactId: r.contact.id }, orderBy: [{ doneAt: "asc" }, { dueAt: "asc" }], take: 20, select: { id: true, title: true, dueAt: true, doneAt: true } }),
    prisma.crmConsent.findMany({ where: { contactId: r.contact.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, kind: true, granted: true, channels: true, noticeText: true, noticeVersion: true, createdAt: true } }),
    prisma.courseRegistration.findMany({ where: { AND: [scope(access), { contactId: r.contact.id, id: { not: id } }] }, select: { id: true, reference: true, course: { select: { title: true } } } }),
    canSeeEmails
      ? prisma.crmEmail.findMany({ where: { contactId: r.contact.id, isTest: false, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, subject: true, subjectRaw: true, status: true, category: true, createdAt: true, sentAt: true, scheduledFor: true, error: true, fromHeader: true, events: { orderBy: { at: "asc" }, select: { type: true, detail: true, at: true } } } })
      : Promise.resolve([]),
  ]);
  const c = r.contact;
  return {
    id: r.id, reference: r.reference, stage: r.stage as Stage, source: r.source as Source, sourceTag: r.sourceTag, createdAt: r.createdAt.toISOString(), followUpAt: r.followUpAt?.toISOString() ?? null,
    course: r.course, motivation: r.motivation, signedName: r.signedName, signedAt: r.signedAt.toISOString(), agreementVersion: r.agreement.version,
    contact: { id: c.id, name: `${c.firstName} ${c.lastName}`, email: canContacts ? c.email : maskEmail(c.email), phone: canContacts ? c.phone : null, country: c.country, state: c.state, optedOut: !!c.optedOutAt, relationships: c.relationships, isTrainee: !!c.traineeId },
    emailOk: r.followUpEmail && !c.optedOutAt, whatsappOk: r.followUpWhatsapp && !c.optedOutAt, newsletter: r.newsletter && !c.optedOutAt,
    activities: activities.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    tasks: tasks.map((t) => ({ ...t, dueAt: t.dueAt?.toISOString() ?? null, doneAt: t.doneAt?.toISOString() ?? null })),
    consents: consents.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
    otherRegistrations: others.map((o) => ({ id: o.id, reference: o.reference, course: o.course.title })),
    emails: emails.map((e) => ({ id: e.id, subject: e.subject ?? e.subjectRaw, status: e.status, category: e.category, createdAt: e.createdAt.toISOString(), sentAt: e.sentAt?.toISOString() ?? null, scheduledFor: e.scheduledFor?.toISOString() ?? null, error: e.error, from: e.fromHeader, events: e.events.map((x) => ({ type: x.type, detail: x.detail, at: x.at.toISOString() })) })),
    suppressed: !!c.emailSuppressedAt,
  };
}

export interface RegistrationPatch { stage?: string; followUpAt?: string | null; note?: string }

/** Changes the stage or follow-up date, or adds a note. Every change goes on the contact's timeline with who made it. */
export async function updateRegistration(access: Access, actorId: string, id: string, patch: RegistrationPatch): Promise<boolean> {
  const reg = await prisma.courseRegistration.findFirst({ where: { AND: [scope(access), { id }] }, select: { id: true, stage: true, contactId: true, followUpAt: true } });
  if (!reg) return false;
  const data: Prisma.CourseRegistrationUpdateInput = {};
  const log: { kind: string; summary: string }[] = [];
  if (patch.stage && patch.stage !== reg.stage && (STAGES as readonly string[]).includes(patch.stage)) {
    data.stage = patch.stage;
    if (patch.stage === "CONTACTED") data.lastContactedAt = new Date();
    log.push({ kind: "STAGE", summary: `Stage changed from ${STAGE_LABEL[reg.stage as Stage] ?? reg.stage} to ${STAGE_LABEL[patch.stage as Stage]}` });
  }
  if (patch.followUpAt !== undefined) {
    const when = patch.followUpAt ? new Date(patch.followUpAt) : null;
    if (when && Number.isNaN(when.getTime())) return false;
    data.followUpAt = when;
    log.push({ kind: "TASK", summary: when ? `Follow-up set for ${when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "Follow-up date cleared" });
  }
  const note = patch.note?.trim();
  if (note) log.push({ kind: "NOTE", summary: note.slice(0, 1000) });
  if (!log.length) return true;
  await prisma.$transaction([
    ...(Object.keys(data).length ? [prisma.courseRegistration.update({ where: { id }, data })] : []),
    prisma.crmActivity.createMany({ data: log.map((l) => ({ contactId: reg.contactId, registrationId: id, kind: l.kind, summary: l.summary, actorId })) }),
  ]);
  return true;
}

export async function completeTask(access: Access, actorId: string, taskId: string): Promise<boolean> {
  const task = await prisma.crmTask.findFirst({ where: { id: taskId, contact: { registrations: { some: scope(access) } } }, select: { id: true, title: true, contactId: true, registrationId: true, doneAt: true } });
  if (!task) return false;
  if (task.doneAt) return true;
  await prisma.$transaction([
    prisma.crmTask.update({ where: { id: taskId }, data: { doneAt: new Date() } }),
    prisma.crmActivity.create({ data: { contactId: task.contactId, registrationId: task.registrationId, kind: "TASK", summary: `Finished: ${task.title}`, actorId } }),
  ]);
  return true;
}

/** The registrations this person may see, as a spreadsheet. Cells that start with = + - or @ are defused so a spreadsheet cannot run them. */
export async function exportCsv(access: Access, canContacts: boolean, f: ListFilters): Promise<string> {
  const rows = await prisma.courseRegistration.findMany({ where: whereFrom(access, f), orderBy: { createdAt: "desc" }, take: 5000, select: rowSelect });
  return toCsv(
    ["Reference", "Registered", "Course", "Name", "Email", "WhatsApp", "Source", "Stage", "Email OK", "WhatsApp OK", "Newsletter", "Agreement version", "Signed"],
    rows.map((r) => [
      r.reference, r.createdAt.toISOString().slice(0, 10), r.course.title, `${r.contact.firstName} ${r.contact.lastName}`, canContacts ? r.contact.email : "", canContacts ? r.contact.phone ?? "" : "",
      SOURCE_LABEL[r.source as Source] ?? r.source, STAGE_LABEL[r.stage as Stage] ?? r.stage, r.followUpEmail && !r.contact.optedOutAt ? "Yes" : "No", r.followUpWhatsapp && !r.contact.optedOutAt ? "Yes" : "No",
      r.newsletter && !r.contact.optedOutAt ? "Yes" : "No", r.agreement.version, r.signedAt.toISOString().slice(0, 10),
    ]),
  );
}

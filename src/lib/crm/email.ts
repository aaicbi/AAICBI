import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { rateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/notifications/email";
import { recordAudit } from "@/lib/rbac/audit";
import type { Access } from "@/lib/rbac/guard";
import { requireRole } from "@/lib/auth/session";
import { PermissionError, accessOf } from "@/lib/rbac/guard";
import { scope } from "@/lib/crm/staff";
import { STAGE_LABEL, type Stage } from "@/lib/crm/registrationCore";
import {
  ATT_MAX_EACH, MERGE_FIELDS, attachmentProblem, canSendEmail, cleanSubject, fromHeaderFor, footerText, htmlToText, renderMerge, safeFilename, sanitizeHtml,
  statusAfterEvent, suppressionFor, unknownFields, wrapLetterhead, type Category, type MergeData, type SenderInfo,
} from "@/lib/crm/emailCore";

export class EmailError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

type Feature = "email" | "templates" | "senders";
const KEY = (access: Access, feature: Feature, action: string) => `${access.kind === "organization" ? "org_crm" : "crm"}.${feature}:${action}`;

/** Signs the person in and refuses (recording the attempt) unless they hold the permission. */
export async function requireCrmEmail(feature: Feature, action: "view" | "create" | "edit" | "manage") {
  const session = await requireRole("SUPER_ADMIN", "ADMIN", "INSTRUCTOR");
  const access = await accessOf(session);
  const key = KEY(access, feature, action);
  if (!access.permissions.has(key)) {
    await recordAudit({ actorId: session.userId, actorRole: access.kind === "organization" ? "ORGANIZATION" : session.role, action: "ACCESS_DENIED", resourceType: "permission", resourceId: key, organizationId: access.organizationId, outcome: "DENIED" });
    throw new PermissionError(key);
  }
  return { session, access };
}

const toInfo = (s: { name: string; fromAddress: string; replyTo: string | null; stream: string; verified: boolean; active: boolean; allowOrganizations: boolean }): SenderInfo => ({
  name: s.name, fromAddress: s.fromAddress, replyTo: s.replyTo, stream: s.stream, verified: s.verified, active: s.active, allowOrganizations: s.allowOrganizations,
});

async function actorLabel(access: Access, userId: string): Promise<{ staffName: string; organisation: { id: string; name: string; email: string } | null }> {
  if (access.kind === "organization" && access.organizationId) {
    const org = await prisma.trainingOrganization.findUnique({ where: { id: access.organizationId }, select: { id: true, name: true, email: true, contactName: true } });
    return { staffName: org?.contactName || org?.name || "The team", organisation: org ? { id: org.id, name: org.name, email: org.email } : null };
  }
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return { staffName: u?.name || "The AAICBI team", organisation: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// What the composer shows

export async function composeOptions(access: Access, userId: string, registrationId: string, canSeeAddress: boolean) {
  const reg = await prisma.courseRegistration.findFirst({
    where: { AND: [scope(access), { id: registrationId }] },
    select: { id: true, reference: true, stage: true, course: { select: { id: true, title: true, startDate: true } }, contact: { select: { id: true, firstName: true, lastName: true, email: true, optedOutAt: true, emailSuppressedAt: true, followUpEmail: true, newsletter: true } } },
  });
  if (!reg) return null;
  const org = access.kind === "organization";
  const [senders, templates, drafts, who] = await Promise.all([
    prisma.emailSender.findMany({ where: { active: true, ...(org ? { allowOrganizations: true } : {}) }, orderBy: { name: "asc" } }),
    prisma.emailTemplate.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, key: true, name: true, category: true, subject: true, body: true, version: true, senderId: true } }),
    prisma.crmEmail.findMany({ where: { registrationId, status: { in: ["DRAFT", "SCHEDULED"] }, isTest: false, createdById: userId }, orderBy: { updatedAt: "desc" }, take: 5, select: { id: true, subjectRaw: true, bodyRaw: true, status: true, scheduledFor: true, senderId: true, templateId: true, category: true } }),
    actorLabel(access, userId),
  ]);
  const c = reg.contact;
  const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1•••$2");
  return {
    registration: { id: reg.id, reference: reg.reference, course: reg.course.title },
    recipient: { name: `${c.firstName} ${c.lastName}`, email: canSeeAddress ? c.email : mask(c.email), serviceOk: !!c.followUpEmail && !c.optedOutAt && !c.emailSuppressedAt, marketingOk: !!c.newsletter && !c.optedOutAt && !c.emailSuppressedAt, optedOut: !!c.optedOutAt, suppressed: !!c.emailSuppressedAt, followUp: c.followUpEmail, newsletter: c.newsletter },
    viaOrganization: who.organisation?.name ?? null,
    replyToOrganization: who.organisation?.email ?? null,
    staffName: who.staffName,
    senders: senders.map((s) => ({ id: s.id, name: s.name, fromAddress: s.fromAddress, stream: s.stream, verified: s.verified, replyTo: s.replyTo, usable: s.verified && (org ? true : !!s.replyTo) })),
    templates,
    drafts: drafts.map((d) => ({ ...d, scheduledFor: d.scheduledFor?.toISOString() ?? null })),
    fields: MERGE_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    sample: sampleData(reg, who.staffName, who.organisation?.name ?? null, null),
  };
}

function sampleData(reg: { reference: string; stage: string; course: { title: string; startDate: Date | null }; contact: { firstName: string; lastName: string } }, staffName: string, orgName: string | null, supportEmail: string | null): MergeData {
  return {
    first_name: reg.contact.firstName, last_name: reg.contact.lastName, full_name: `${reg.contact.firstName} ${reg.contact.lastName}`, course_name: reg.course.title,
    application_reference: reg.reference, application_status: STAGE_LABEL[reg.stage as Stage] ?? reg.stage, organisation_name: orgName ?? "AAICBI", assigned_staff_name: staffName,
    support_email: supportEmail, course_start_date: reg.course.startDate ? reg.course.startDate.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Sending

export type EmailAction = "send" | "test" | "draft" | "schedule";
export interface EmailInput {
  action: EmailAction;
  registrationId: string;
  senderId: string;
  templateId?: string | null;
  category: Category;
  subject: string;
  body: string;
  draftId?: string | null;
  scheduledFor?: string | null;
  attachments?: { filename: string; contentBase64: string }[];
}

/** Renders the final subject, HTML and text for one email. */
function render(i: { subjectRaw: string; bodyRaw: string; data: MergeData; sender: SenderInfo; organisationName: string | null; category: Category; stopUrl: string }) {
  const subject = cleanSubject(renderMerge(i.subjectRaw, i.data, "text"));
  const inner = renderMerge(sanitizeHtml(i.bodyRaw), i.data, "html");
  const html = wrapLetterhead({ bodyHtml: inner, senderName: i.sender.name, organisationName: i.organisationName, category: i.category, stopUrl: i.stopUrl, logoUrl: appUrl("/logo.svg") });
  const text = htmlToText(inner) + footerText({ organisationName: i.organisationName, category: i.category, stopUrl: i.stopUrl });
  return { subject, html, text };
}

const validateContent = (subject: string, body: string) => {
  const subj = cleanSubject(subject);
  const clean = sanitizeHtml(body);
  if (!subj) throw new EmailError("Write a subject.", 400, "NO_SUBJECT");
  if (htmlToText(clean).length < 2) throw new EmailError("Write a message.", 400, "NO_BODY");
  if (clean.length > 20000) throw new EmailError("The message is too long.", 400, "TOO_LONG");
  const bad = unknownFields(subj + " " + clean);
  if (bad.length) throw new EmailError(`These fields do not exist: ${bad.map((b) => `{{${b}}}`).join(", ")}. Use the field buttons.`, 400, "UNKNOWN_FIELD");
  return { subj, clean };
};

function readAttachments(list: EmailInput["attachments"]) {
  const files = (list ?? []).map((a) => ({ filename: safeFilename(a.filename), content: Buffer.from(a.contentBase64, "base64") }));
  const problem = attachmentProblem(files.map((f) => ({ filename: f.filename, size: f.content.length })));
  if (problem) throw new EmailError(problem, 400, "ATTACHMENT");
  if (files.some((f) => f.content.length > ATT_MAX_EACH)) throw new EmailError("An attachment is too large.", 400, "ATTACHMENT");
  return files;
}

export interface EmailResult { id: string; status: string; error?: string }

/** Writes, sends, tests, saves or schedules one email to a registrant. Every refusal says why, in plain words. */
export async function submitEmail(access: Access, userId: string, userEmail: string, input: EmailInput): Promise<EmailResult> {
  const reg = await prisma.courseRegistration.findFirst({
    where: { AND: [scope(access), { id: input.registrationId }] },
    select: { id: true, reference: true, stage: true, organizationId: true, course: { select: { title: true, startDate: true } }, contact: { select: { id: true, firstName: true, lastName: true, email: true, optedOutAt: true, emailSuppressedAt: true, followUpEmail: true, newsletter: true, optOutToken: true } } },
  });
  if (!reg) throw new EmailError("Registration not found.", 404);
  const sender = await prisma.emailSender.findUnique({ where: { id: input.senderId } });
  if (!sender) throw new EmailError("Choose a sender.", 400, "NO_SENDER");
  const who = await actorLabel(access, userId);
  const info = toInfo(sender);
  const viaOrganization = access.kind === "organization";
  const { subj, clean } = validateContent(input.subject, input.body);
  const files = readAttachments(input.attachments);
  const c = reg.contact;
  const recipient = { email: c.email, optedOutAt: c.optedOutAt, emailSuppressedAt: c.emailSuppressedAt, followUpEmail: c.followUpEmail, newsletter: c.newsletter };
  const base = {
    ownerKey: reg.organizationId ?? "PLATFORM", organizationId: reg.organizationId, contactId: c.id, registrationId: reg.id, senderId: sender.id, templateId: input.templateId || null,
    category: input.category, subjectRaw: subj, bodyRaw: clean, replyTo: viaOrganization ? who.organisation?.email ?? null : sender.replyTo, attachmentNames: files.map((f) => f.filename), createdById: userId,
  };
  const templateVersion = input.templateId ? (await prisma.emailTemplate.findUnique({ where: { id: input.templateId }, select: { version: true } }))?.version ?? null : null;

  if (input.action === "draft") {
    const data = { ...base, templateVersion, toEmail: c.email, status: "DRAFT", scheduledFor: null };
    const row = input.draftId
      ? await prisma.crmEmail.update({ where: { id: input.draftId, createdById: userId, status: { in: ["DRAFT", "SCHEDULED"] }, registrationId: reg.id }, data })
      : await prisma.crmEmail.create({ data });
    return { id: row.id, status: row.status };
  }

  // Everything below sends something, so the sender must be usable. A test goes to the writer's own address, so the person's consent does not apply to it.
  if (input.action === "test") {
    if (!sender.active || !sender.verified) throw new EmailError("This sender is not verified yet, so nothing can be sent from it.", 409, "SENDER_UNVERIFIED");
    const tl = await rateLimit(`crm-email-test:${userId}`, 20, 60 * 60_000);
    if (!tl.allowed) throw new EmailError("That is a lot of test emails. Please wait a little.", 429);
    const rendered = render({ subjectRaw: subj, bodyRaw: clean, data: sampleData(reg, who.staffName, who.organisation?.name ?? null, base.replyTo), sender: info, organisationName: who.organisation?.name ?? null, category: input.category, stopUrl: appUrl(`/crm/optout/${c.optOutToken}`) });
    const row = await prisma.crmEmail.create({ data: { ...base, templateVersion, toEmail: userEmail, status: "SENDING", isTest: true, subject: `[Test] ${rendered.subject}`, bodyHtml: rendered.html, bodyText: rendered.text } });
    return dispatch(row.id, { to: userEmail, subject: `[Test] ${rendered.subject}`, html: rendered.html, text: rendered.text, from: fromHeaderFor(info, who.organisation?.name ?? null), replyTo: base.replyTo ?? undefined, files, timeline: null });
  }

  const verdict = canSendEmail({ category: input.category, recipient, sender: info, viaOrganization });
  if (!verdict.ok) throw new EmailError(verdict.message, 409, verdict.code);

  if (input.action === "schedule") {
    const when = input.scheduledFor ? new Date(input.scheduledFor) : null;
    if (!when || Number.isNaN(when.getTime())) throw new EmailError("Choose when to send it.", 400, "NO_TIME");
    if (when.getTime() < Date.now() + 5 * 60_000) throw new EmailError("Choose a time at least 5 minutes from now.", 400, "TIME_PAST");
    if (when.getTime() > Date.now() + 60 * 86400_000) throw new EmailError("Choose a time within the next 60 days.", 400, "TIME_FAR");
    const data = { ...base, templateVersion, toEmail: c.email, status: "SCHEDULED", scheduledFor: when };
    const row = input.draftId
      ? await prisma.crmEmail.update({ where: { id: input.draftId, createdById: userId, status: { in: ["DRAFT", "SCHEDULED"] }, registrationId: reg.id }, data })
      : await prisma.crmEmail.create({ data });
    await prisma.crmActivity.create({ data: { contactId: c.id, registrationId: reg.id, kind: "EMAIL_SENT", summary: `Email scheduled for ${when.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}: "${subj}"`, actorId: userId } });
    return { id: row.id, status: row.status };
  }

  const byUser = await rateLimit(`crm-email:${userId}`, 60, 60 * 60_000);
  if (!byUser.allowed) throw new EmailError("You have sent a lot of emails in the last hour. Please wait a little.", 429, "RATE_USER");
  const byContact = await rateLimit(`crm-email-contact:${c.id}`, 5, 24 * 60 * 60_000);
  if (!byContact.allowed) throw new EmailError("This person has already had several emails today. Please wait until tomorrow.", 429, "RATE_CONTACT");

  const rendered = render({ subjectRaw: subj, bodyRaw: clean, data: sampleData(reg, who.staffName, who.organisation?.name ?? null, base.replyTo), sender: info, organisationName: who.organisation?.name ?? null, category: input.category, stopUrl: appUrl(`/crm/optout/${c.optOutToken}`) });
  const data = { ...base, templateVersion, toEmail: c.email, status: "SENDING", subject: rendered.subject, bodyHtml: rendered.html, bodyText: rendered.text, fromHeader: fromHeaderFor(info, who.organisation?.name ?? null), scheduledFor: null };
  const row = input.draftId
    ? await prisma.crmEmail.update({ where: { id: input.draftId, createdById: userId, status: { in: ["DRAFT", "SCHEDULED"] }, registrationId: reg.id }, data })
    : await prisma.crmEmail.create({ data });
  return dispatch(row.id, { to: c.email, subject: rendered.subject, html: rendered.html, text: rendered.text, from: data.fromHeader, replyTo: base.replyTo ?? undefined, files, timeline: { contactId: c.id, registrationId: reg.id, actorId: userId }, stopUrl: appUrl(`/crm/optout/${c.optOutToken}`), actorRole: access.kind === "organization" ? "ORGANIZATION" : "STAFF", organizationId: reg.organizationId });
}

interface DispatchInput {
  to: string; subject: string; html: string; text: string; from: string; replyTo?: string; files: { filename: string; content: Buffer }[];
  timeline: { contactId: string; registrationId: string; actorId: string } | null; stopUrl?: string; actorRole?: string; organizationId?: string | null;
}

/** Hands the email to Resend and records exactly what came back: accepted with its id, or failed with the reason. Never "delivered". */
async function dispatch(emailId: string, d: DispatchInput): Promise<EmailResult> {
  const result = await sendEmail({
    to: d.to, subject: d.subject, html: d.html, text: d.text, from: d.from, replyTo: d.replyTo, attachments: d.files.length ? d.files : undefined, idempotencyKey: `crm-email-${emailId}`,
    headers: d.stopUrl ? { "List-Unsubscribe": `<${d.stopUrl}>` } : undefined,
  });
  const now = new Date();
  if (result.ok) {
    await prisma.$transaction([
      prisma.crmEmail.update({ where: { id: emailId }, data: { status: "ACCEPTED", providerId: result.id ?? null, sentAt: now, acceptedAt: now, error: null } }),
      prisma.crmEmailEvent.create({ data: { emailId, type: "accepted", detail: "Resend accepted the email" } }),
      ...(d.timeline ? [prisma.crmActivity.create({ data: { ...d.timeline, kind: "EMAIL_SENT", summary: `Email sent: "${d.subject}". Resend accepted it; delivery is shown below when Resend reports it.` } })] : []),
    ]);
    if (d.timeline) await recordAudit({ actorId: d.timeline.actorId, actorRole: d.actorRole, action: "CRM_EMAIL_SENT", resourceType: "email", resourceId: emailId, organizationId: d.organizationId });
    return { id: emailId, status: "ACCEPTED" };
  }
  const error = (result.error ?? "Unknown error").slice(0, 300);
  await prisma.$transaction([
    prisma.crmEmail.update({ where: { id: emailId }, data: { status: "FAILED", error } }),
    prisma.crmEmailEvent.create({ data: { emailId, type: "failed", detail: error } }),
    ...(d.timeline ? [prisma.crmActivity.create({ data: { ...d.timeline, kind: "EMAIL_SENT", summary: `Email could not be sent: "${d.subject}" (${error})` } })] : []),
  ]);
  return { id: emailId, status: "FAILED", error };
}

/**
 * Sends the scheduled emails that have come due. Run by the hourly job. Each one is claimed first so two runs never send it twice, and the
 * person's consent is checked again at send time: someone who opted out after it was scheduled is skipped, with a note on the timeline.
 */
export async function processScheduledEmails(limit = 50): Promise<{ sent: number; skipped: number; failed: number }> {
  const due = await prisma.crmEmail.findMany({ where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } }, orderBy: { scheduledFor: "asc" }, take: limit, select: { id: true } });
  let sent = 0, skipped = 0, failed = 0;
  for (const { id } of due) {
    const claimed = await prisma.crmEmail.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "SENDING" } });
    if (claimed.count !== 1) continue;
    const e = await prisma.crmEmail.findUniqueOrThrow({ where: { id }, include: { sender: true, contact: true } });
    const stop = async (message: string) => {
      await prisma.$transaction([
        prisma.crmEmail.update({ where: { id }, data: { status: "FAILED", error: message } }),
        prisma.crmActivity.create({ data: { contactId: e.contactId, registrationId: e.registrationId, kind: "EMAIL_SENT", summary: `Scheduled email not sent: "${e.subjectRaw}" (${message})`, actorId: e.createdById } }),
      ]);
    };
    const org = e.organizationId ? await prisma.trainingOrganization.findUnique({ where: { id: e.organizationId }, select: { name: true, email: true, crmEnabled: true } }) : null;
    if (e.organizationId && !org?.crmEnabled) { await stop("the CRM was switched off for this organization"); skipped++; continue; }
    const verdict = canSendEmail({ category: e.category as Category, recipient: { email: e.contact.email, optedOutAt: e.contact.optedOutAt, emailSuppressedAt: e.contact.emailSuppressedAt, followUpEmail: e.contact.followUpEmail, newsletter: e.contact.newsletter }, sender: toInfo(e.sender), viaOrganization: !!e.organizationId });
    if (!verdict.ok) { await stop(verdict.message); skipped++; continue; }
    const reg = e.registrationId ? await prisma.courseRegistration.findUnique({ where: { id: e.registrationId }, select: { reference: true, stage: true, course: { select: { title: true, startDate: true } } } }) : null;
    const author = await prisma.user.findUnique({ where: { id: e.createdById }, select: { name: true } });
    if (!reg) { await stop("the registration no longer exists"); failed++; continue; }
    const info = toInfo(e.sender);
    const orgName = org?.name ?? null;
    const stopUrl = appUrl(`/crm/optout/${e.contact.optOutToken}`);
    const rendered = render({ subjectRaw: e.subjectRaw, bodyRaw: e.bodyRaw, data: sampleData({ ...reg, contact: e.contact }, orgName ? org?.name ?? "The team" : author?.name ?? "The AAICBI team", orgName, e.replyTo), sender: info, organisationName: orgName, category: e.category as Category, stopUrl });
    const from = fromHeaderFor(info, orgName);
    await prisma.crmEmail.update({ where: { id }, data: { subject: rendered.subject, bodyHtml: rendered.html, bodyText: rendered.text, fromHeader: from } });
    const out = await dispatch(id, { to: e.toEmail, subject: rendered.subject, html: rendered.html, text: rendered.text, from, replyTo: e.replyTo ?? undefined, files: [], timeline: { contactId: e.contactId, registrationId: e.registrationId as string, actorId: e.createdById }, stopUrl, actorRole: orgName ? "ORGANIZATION" : "STAFF", organizationId: e.organizationId });
    if (out.status === "ACCEPTED") sent++; else failed++;
  }
  return { sent, skipped, failed };
}

// ---------------------------------------------------------------------------------------------------------------------
// Delivery reports from Resend

export interface ResendEvent { type?: string; data?: { email_id?: string; bounce?: { type?: string; message?: string; subType?: string }; reason?: string } }

/**
 * Applies one delivery report. Reports are matched by Resend's message id; one for an email we did not send is ignored. The report's own id makes
 * this safe to receive twice. A permanent bounce or a spam complaint switches the address off and leaves staff a task.
 */
export async function applyResendEvent(eventId: string, ev: ResendEvent): Promise<"applied" | "duplicate" | "ignored"> {
  const type = (ev.type ?? "").replace(/^email\./, "");
  const providerId = ev.data?.email_id;
  if (!type || !providerId) return "ignored";
  const email = await prisma.crmEmail.findUnique({ where: { providerId }, select: { id: true, status: true, contactId: true, registrationId: true, subject: true, subjectRaw: true, isTest: true } });
  if (!email) return "ignored";
  const detail = (ev.data?.bounce?.message ?? ev.data?.reason ?? ev.data?.bounce?.type ?? "").toString().slice(0, 300) || null;
  try {
    await prisma.crmEmailEvent.create({ data: { emailId: email.id, type, detail, providerEventId: eventId } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return "duplicate";
    throw e;
  }
  const next = statusAfterEvent(email.status as never, type);
  const data: Prisma.CrmEmailUpdateInput = { status: next };
  if (type === "delivered" && next === "DELIVERED") data.deliveredAt = new Date();
  if (type === "bounced") data.bouncedAt = new Date();
  if (type === "bounced" || type === "complained") data.error = detail ?? type;
  await prisma.crmEmail.update({ where: { id: email.id }, data });
  const why = suppressionFor(type, ev.data?.bounce?.type);
  if (why && !email.isTest) {
    const contact = await prisma.crmContact.findUnique({ where: { id: email.contactId }, select: { id: true, firstName: true, lastName: true, organizationId: true, emailSuppressedAt: true } });
    if (contact && !contact.emailSuppressedAt) {
      await prisma.$transaction([
        prisma.crmContact.update({ where: { id: contact.id }, data: { emailSuppressedAt: new Date(), emailSuppressedReason: why } }),
        prisma.crmActivity.create({ data: { contactId: contact.id, registrationId: email.registrationId, kind: "EMAIL_SENT", summary: why === "COMPLAINT" ? `Reported as spam: "${email.subject ?? email.subjectRaw}". Email to this address is switched off.` : `Bounced: "${email.subject ?? email.subjectRaw}"${detail ? ` (${detail})` : ""}. Email to this address is switched off.` } }),
        prisma.crmTask.create({ data: { contactId: contact.id, registrationId: email.registrationId, organizationId: contact.organizationId, title: `Ask ${contact.firstName} ${contact.lastName} for a working email address` } }),
      ]);
    }
  }
  return "applied";
}

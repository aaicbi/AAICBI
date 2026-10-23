import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { sendEmail } from "@/lib/notifications/email";
import { notifyByEmail } from "@/lib/notifications/log";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";
import { registrationConfirmationEmail, registrationReceivedEmail } from "@/lib/notifications/templates";
import {
  CLOSED_MESSAGE, FOLLOW_UP_NOTICE, NEWSLETTER_NOTICE, consentChannels, isReference, looksLikeBot, makeReference, ownerKeyOf, registrationState,
  sanitizeTag, signatureMatches, sourceOf, suggestFreeCourses, type RegistrationInputT, type RegistrationState,
} from "@/lib/crm/registrationCore";

export class RegistrationError extends Error {
  constructor(message: string, public status = 400, public field?: string) {
    super(message);
  }
}

const hashIp = (ip: string): string => createHmac("sha256", process.env.AUTH_SECRET || "crm").update(ip).digest("hex").slice(0, 32);
const dayText = (d: Date | null): string | null => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null);

export async function activeAgreement() {
  return prisma.registrationAgreement.findFirst({ where: { active: true }, orderBy: { version: "desc" } });
}

const COURSE_SELECT = {
  id: true, title: true, description: true, status: true, registrationEnabled: true, capacity: true, startDate: true, endDate: true,
  registrationDeadline: true, lifecyclePhaseOverride: true, category: true, durationDisplay: true, trainingFormat: true, instructorNames: true,
  learningOutcomes: true, prerequisites: true, isFree: true, priceKobo: true, discountPercent: true, createdById: true,
  showWhatYoullLearn: true, showOutline: true, showRequirements: true,
  modules: { orderBy: { order: "asc" as const }, select: { id: true, title: true, description: true } },
};

async function ownerOf(createdById: string) {
  const org = await findTrainingOrgByStaffUserId(createdById);
  return org ? { id: org.id, name: org.name, email: org.email } : null;
}

/** Free published courses to suggest, ranked by relevance and popularity. */
export async function freeCourseSuggestions(opts: { excludeIds: string[]; category: string | null; limit?: number }) {
  const rows = await prisma.course.findMany({
    where: { isFree: true, status: "PUBLISHED", isDemo: false, id: { notIn: opts.excludeIds } },
    select: { id: true, title: true, category: true, durationDisplay: true, _count: { select: { courseEnrollments: true } } },
    take: 40,
  });
  return suggestFreeCourses(rows.map((r) => ({ id: r.id, title: r.title, category: r.category, durationDisplay: r.durationDisplay, enrolled: r._count.courseEnrollments })), { ...opts, limit: opts.limit ?? 3 });
}

export interface RegisterPageData {
  course: {
    id: string; title: string; description: string | null; category: string | null; durationDisplay: string | null; trainingFormat: string | null;
    instructorNames: string | null; startDate: string | null; registrationDeadline: string | null; outcomes: string[]; prerequisites: string[];
    modules: { id: string; title: string; description: string | null }[]; feeText: string;
  };
  organisationName: string | null;
  state: RegistrationState;
  stateMessage: string | null;
  agreement: { version: number; title: string; body: string } | null;
  suggestions: { id: string; title: string; durationDisplay: string | null }[];
}

/** Everything the public registration page shows. null when the course does not exist or is not public at all. */
export async function getRegisterPage(courseId: string): Promise<RegisterPageData | null> {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: COURSE_SELECT });
  if (!course || (course.status !== "PUBLISHED" && course.status !== "UNLISTED")) return null;
  const [owner, registered, agreement] = await Promise.all([
    ownerOf(course.createdById),
    prisma.courseRegistration.count({ where: { courseId, stage: { not: "WITHDRAWN" } } }),
    activeAgreement(),
  ]);
  const state = registrationState(course, registered);
  const priceKobo = course.priceKobo ?? 0;
  const feeText = course.isFree || priceKobo === 0 ? "Free to register. We will tell you about any course fee before you decide." : `Course fee: ₦${Math.round((priceKobo * (100 - (course.discountPercent ?? 0))) / 100 / 100).toLocaleString("en-NG")}. Registering is free and does not commit you to pay.`;
  return {
    course: {
      id: course.id, title: course.title, description: course.description, category: course.category, durationDisplay: course.durationDisplay,
      trainingFormat: course.trainingFormat, instructorNames: course.instructorNames, startDate: course.startDate?.toISOString() ?? null,
      registrationDeadline: course.registrationDeadline?.toISOString() ?? null,
      outcomes: course.showWhatYoullLearn ? course.learningOutcomes : [], prerequisites: course.showRequirements ? course.prerequisites : [],
      modules: course.showOutline ? course.modules : [], feeText,
    },
    organisationName: owner?.name ?? null,
    state,
    stateMessage: state.open ? null : CLOSED_MESSAGE[state.reason],
    agreement: agreement ? { version: agreement.version, title: agreement.title, body: agreement.body } : null,
    suggestions: (await freeCourseSuggestions({ excludeIds: [courseId], category: course.category })).map((c) => ({ id: c.id, title: c.title, durationDisplay: c.durationDisplay })),
  };
}

export interface SubmitContext { ip: string; userAgent: string | null }
export interface SubmitResult { reference: string; duplicate: boolean }

/**
 * Saves a registration: the contact (one per owner and email, never duplicated), the signed agreement, the consent, a follow-up task and the
 * timeline. A person who registers twice for the same course gets their existing reference back. Mail and staff notices go out after the
 * save and never undo it.
 */
export async function submitRegistration(courseId: string, input: RegistrationInputT, ctx: SubmitContext): Promise<SubmitResult> {
  if (looksLikeBot(input)) throw new RegistrationError("Something went wrong. Please reload the page and try again.", 400);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: COURSE_SELECT });
  if (!course) throw new RegistrationError("This course was not found.", 404);
  const owner = await ownerOf(course.createdById);
  const registered = await prisma.courseRegistration.count({ where: { courseId, stage: { not: "WITHDRAWN" } } });
  const state = registrationState(course, registered);
  if (!state.open) throw new RegistrationError(CLOSED_MESSAGE[state.reason], 409);

  const agreement = await activeAgreement();
  if (!agreement) throw new RegistrationError("Registration is not available right now.", 503);
  if (input.agreementVersion !== agreement.version) throw new RegistrationError("The agreement was updated. Please reload the page and read it again.", 409, "agreement");
  if (!signatureMatches(input.signedName, input.firstName, input.lastName)) throw new RegistrationError("Type your first and last name exactly as you entered them above.", 400, "signedName");

  const tag = sanitizeTag(input.src);
  let play: { id: string } | null = null;
  if (input.play) {
    const found = await prisma.growthGuestPlay.findUnique({ where: { token: input.play }, select: { id: true, campaign: { select: { courseId: true } } } });
    if (found && found.campaign.courseId === courseId) play = { id: found.id };
  }
  const source = sourceOf({ fromTaster: !!play, tag });
  const ownerKey = ownerKeyOf(owner?.id);
  const channels = consentChannels(input.followUp);
  const trainee = await prisma.trainee.findFirst({ where: { email: { equals: input.email, mode: "insensitive" } }, select: { id: true } });
  const name = `${input.firstName} ${input.lastName}`;

  const result = await prisma.$transaction(async (tx) => {
    const existingContact = await tx.crmContact.findUnique({ where: { ownerKey_email: { ownerKey, email: input.email } } });
    const relationships = new Set(existingContact?.relationships ?? ["PROSPECT"]);
    if (trainee) relationships.add("TRAINEE");
    const contactData = {
      firstName: input.firstName, lastName: input.lastName, phone: input.phone, country: input.country, state: input.state || existingContact?.state || null,
      followUpEmail: true, followUpWhatsapp: true, newsletter: input.newsletter, optedOutAt: null, traineeId: trainee?.id ?? existingContact?.traineeId ?? null,
      relationships: Array.from(relationships),
    };
    const contact = existingContact
      ? await tx.crmContact.update({ where: { id: existingContact.id }, data: contactData })
      : await tx.crmContact.create({ data: { ownerKey, organizationId: owner?.id ?? null, email: input.email, firstSource: source, optOutToken: randomBytes(18).toString("hex"), ...contactData } });

    const existing = await tx.courseRegistration.findUnique({ where: { courseId_contactId: { courseId, contactId: contact.id } } });
    if (existing) return { reference: existing.reference, duplicate: true, contactId: contact.id, registrationId: existing.id, optOutToken: contact.optOutToken, fresh: false };

    let reference = makeReference(new Date().getFullYear());
    for (let i = 0; i < 5 && (await tx.courseRegistration.findUnique({ where: { reference }, select: { id: true } })); i++) reference = makeReference(new Date().getFullYear());
    const reg = await tx.courseRegistration.create({
      data: {
        reference, courseId, contactId: contact.id, organizationId: owner?.id ?? null, motivation: input.motivation || null, source, sourceTag: tag,
        growthPlayId: play?.id ?? null, agreementId: agreement.id, signedName: input.signedName, signedAt: new Date(), signIpHash: hashIp(ctx.ip),
        signUserAgent: ctx.userAgent?.slice(0, 300) ?? null, followUpEmail: true, followUpWhatsapp: true, newsletter: input.newsletter,
      },
    });
    await tx.crmConsent.create({ data: { contactId: contact.id, kind: "FOLLOW_UP", granted: true, channels, noticeText: FOLLOW_UP_NOTICE, noticeVersion: agreement.version, source: `registration:${reg.reference}` } });
    await tx.crmConsent.create({ data: { contactId: contact.id, kind: "NEWSLETTER", granted: input.newsletter, channels: input.newsletter ? ["EMAIL"] : [], noticeText: NEWSLETTER_NOTICE, noticeVersion: agreement.version, source: `registration:${reg.reference}` } });
    await tx.crmActivity.createMany({
      data: [
        { contactId: contact.id, registrationId: reg.id, kind: "REGISTERED", summary: `Registered for ${course.title}${play ? " from the taster game" : tag ? ` (source: ${tag})` : ""}` },
        { contactId: contact.id, registrationId: reg.id, kind: "AGREEMENT_SIGNED", summary: `Signed ${agreement.title} version ${agreement.version} as "${input.signedName}"` },
        { contactId: contact.id, registrationId: reg.id, kind: "CONSENT", summary: `Agreed to follow-up by email and WhatsApp${input.newsletter ? " and to newsletters" : ""}` },
      ],
    });
    await tx.crmTask.create({ data: { contactId: contact.id, registrationId: reg.id, organizationId: owner?.id ?? null, title: `Welcome ${name} and follow up on ${course.title}`, dueAt: new Date(Date.now() + 24 * 60 * 60_000) } });
    return { reference: reg.reference, duplicate: false, contactId: contact.id, registrationId: reg.id, optOutToken: contact.optOutToken, fresh: true };
  });

  if (result.fresh) await afterRegistration({ course, owner, name, firstName: input.firstName, email: input.email, ...result });
  return { reference: result.reference, duplicate: result.duplicate };
}

async function afterRegistration(a: {
  course: { id: string; title: string; category: string | null; startDate: Date | null };
  owner: { id: string; name: string; email: string } | null; name: string; firstName: string; email: string;
  reference: string; contactId: string; registrationId: string; optOutToken: string;
}) {
  // Confirmation to the person. Recorded as accepted or failed by the mail provider, never as delivered.
  try {
    const free = await freeCourseSuggestions({ excludeIds: [a.course.id], category: a.course.category });
    const content = registrationConfirmationEmail({
      firstName: a.firstName, courseTitle: a.course.title, reference: a.reference, startDateText: dayText(a.course.startDate), organisationName: a.owner?.name ?? null,
      freeCourses: free.map((c) => ({ title: c.title, url: appUrl(`/courses/${c.id}`) })), statusUrl: appUrl(`/register/${a.course.id}/done?ref=${a.reference}`), stopUrl: appUrl(`/crm/optout/${a.optOutToken}`),
    });
    const sent = await sendEmail({ to: a.email, ...content });
    await prisma.crmActivity.create({ data: { contactId: a.contactId, registrationId: a.registrationId, kind: "EMAIL_SENT", summary: sent.ok ? "Confirmation email accepted by the mail provider" : `Confirmation email could not be sent: ${sent.error ?? "unknown error"}` } });
  } catch (e) {
    console.error("Registration confirmation failed", e);
  }
  // Tell the owner. Never allowed to affect the registration.
  try {
    const content = registrationReceivedEmail({ courseTitle: a.course.title, personName: a.name, reference: a.reference, crmUrl: appUrl(`/admin/crm?r=${a.registrationId}`) });
    if (a.owner) await notifyByEmail({ recipientType: "TRAINING_ORG", recipientId: a.owner.id, to: a.owner.email, type: "CRM_REGISTRATION", relatedId: a.registrationId, url: "/admin/crm", ...content });
    else await notifyAllAdminStaff("CRM_REGISTRATION", a.registrationId, content, "/admin/crm");
  } catch (e) {
    console.error("Registration notice failed", e);
  }
}

export interface ConfirmationData {
  reference: string;
  courseId: string;
  courseTitle: string;
  startDate: string | null;
  organisationName: string | null;
  suggestions: { id: string; title: string; durationDisplay: string | null }[];
}

/** What the confirmation page shows. Only the course and the reference: nothing personal, so the reference alone reveals nothing about the person. */
export async function getConfirmation(courseId: string, reference: string): Promise<ConfirmationData | null> {
  if (!isReference(reference)) return null;
  const reg = await prisma.courseRegistration.findUnique({ where: { reference }, select: { courseId: true, course: { select: { title: true, startDate: true, category: true, createdById: true } } } });
  if (!reg || reg.courseId !== courseId) return null;
  const owner = await ownerOf(reg.course.createdById);
  const free = await freeCourseSuggestions({ excludeIds: [courseId], category: reg.course.category });
  return { reference, courseId, courseTitle: reg.course.title, startDate: reg.course.startDate?.toISOString() ?? null, organisationName: owner?.name ?? null, suggestions: free.map((c) => ({ id: c.id, title: c.title, durationDisplay: c.durationDisplay })) };
}

/** The private "stop messages" link: marks the contact as opted out and records it. Returns false for an unknown link. */
export async function optOutByToken(token: string): Promise<boolean> {
  if (!/^[a-f0-9]{20,64}$/.test(token)) return false;
  const contact = await prisma.crmContact.findUnique({ where: { optOutToken: token }, select: { id: true, optedOutAt: true } });
  if (!contact) return false;
  if (contact.optedOutAt) return true;
  await prisma.$transaction([
    prisma.crmContact.update({ where: { id: contact.id }, data: { optedOutAt: new Date(), followUpEmail: false, followUpWhatsapp: false, newsletter: false } }),
    prisma.crmConsent.create({ data: { contactId: contact.id, kind: "FOLLOW_UP", granted: false, channels: [], noticeText: "Stopped all messages using the link in an email.", noticeVersion: 0, source: "optout-link" } }),
    prisma.crmActivity.create({ data: { contactId: contact.id, kind: "CONSENT", summary: "Opted out of all messages using the stop link" } }),
  ]);
  return true;
}


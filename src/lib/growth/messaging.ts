import { prisma } from "@/lib/prisma";
import { appUrl } from "@/lib/appUrl";
import { sendEmail } from "@/lib/notifications/email";
import { sendWhatsApp, whatsAppConfigured, whatsAppEnabled } from "@/lib/notifications/whatsapp";
import { loadWhatsAppConfig } from "@/lib/notifications/whatsappConfig";
import { tasterRank } from "@/lib/growth/growthCore";
import {
  CHANNELS, DEFAULT_DAILY_CAP, DEFAULT_QUIET, DEFAULT_TEMPLATES, KIND_LABEL, LEAD_WINDOW_DAYS, MESSAGE_KINDS, checkTemplate, cleanQuiet, dueKind, inQuietHours, metaTemplateText, nextStatus,
  renderMessage, waMeLink, whatsAppVariables, type Channel, type MessageKind, type MessageStatus, type ParsedWebhook, type Quiet, type RenderVars, type SentRecord, type TemplateDef,
} from "@/lib/growth/messagingCore";

export class MessagingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------- settings

export interface MessagingSettings { enabled: boolean; channel: Channel; dailyCap: number; quiet: Quiet; templates: Record<MessageKind, TemplateDef>; custom: Record<MessageKind, boolean> }

function parseTemplates(raw: unknown) {
  const out = {} as Record<MessageKind, TemplateDef>;
  const custom = {} as Record<MessageKind, boolean>;
  const r = (raw ?? {}) as Record<string, { body?: unknown; waTemplate?: unknown } | undefined>;
  for (const k of MESSAGE_KINDS) {
    const c = r[k] ? checkTemplate(r[k]!) : null;
    custom[k] = !!c?.ok;
    out[k] = c?.ok ? { body: c.body, waTemplate: c.waTemplate || DEFAULT_TEMPLATES[k].waTemplate } : DEFAULT_TEMPLATES[k];
  }
  return { templates: out, custom };
}

export async function getMessagingSettings(): Promise<MessagingSettings> {
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: "MESSAGING", scopeId: "" } } });
  const cfg = (row?.config ?? {}) as Record<string, unknown>;
  const channel = CHANNELS.includes(cfg.channel as Channel) ? (cfg.channel as Channel) : "MANUAL";
  const cap = typeof cfg.dailyCap === "number" && Number.isInteger(cfg.dailyCap) && cfg.dailyCap >= 1 && cfg.dailyCap <= 5000 ? cfg.dailyCap : DEFAULT_DAILY_CAP;
  const { templates, custom } = parseTemplates(cfg.templates);
  return { enabled: !!row?.enabled, channel, dailyCap: cap, quiet: cleanQuiet(cfg.quiet), templates, custom };
}

async function writeConfig(actorId: string, patch: { enabled?: boolean; config?: Record<string, unknown> }) {
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: "MESSAGING", scopeId: "" } } });
  const config = { ...((row?.config ?? {}) as Record<string, unknown>), ...(patch.config ?? {}) };
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: "MESSAGING", scopeId: "" } },
    create: { scopeType: "MESSAGING", scopeId: "", enabled: patch.enabled ?? false, config: config as object, updatedById: actorId },
    update: { ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}), config: config as object, updatedById: actorId },
  });
}

async function audit(actorId: string, action: string, detail?: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType: "MESSAGING", scopeId: "", detail: detail?.slice(0, 300) ?? null } });
}

export async function updateMessagingSettings(actorId: string, patch: { enabled?: boolean; channel?: unknown; dailyCap?: unknown; quiet?: unknown }) {
  const config: Record<string, unknown> = {};
  if (patch.channel !== undefined) {
    if (!CHANNELS.includes(patch.channel as Channel)) throw new MessagingError("Choose manual, WhatsApp or email.");
    config.channel = patch.channel;
  }
  if (patch.dailyCap !== undefined) {
    const n = Number(patch.dailyCap);
    if (!Number.isInteger(n) || n < 1 || n > 5000) throw new MessagingError("The daily limit is a whole number from 1 to 5000.");
    config.dailyCap = n;
  }
  if (patch.quiet !== undefined) config.quiet = cleanQuiet(patch.quiet);
  const current = await getMessagingSettings();
  // Whenever messaging will be on, the channel it uses has to be set up on this server.
  if (patch.enabled === true || (patch.enabled === undefined && current.enabled && config.channel !== undefined)) {
    const channel = (config.channel as Channel | undefined) ?? current.channel;
    if (channel === "WHATSAPP" && !(await whatsAppConfigured())) throw new MessagingError("WhatsApp is not switched on yet. Choose manual, or save the WhatsApp credentials and switch it on first.", 409);
    if (channel === "EMAIL" && !process.env.RESEND_API_KEY) throw new MessagingError("Email sending is not set up on this server (RESEND_API_KEY).", 409);
  }
  await writeConfig(actorId, { enabled: patch.enabled, config });
  if (patch.enabled !== undefined) await audit(actorId, patch.enabled ? "MESSAGING_ON" : "MESSAGING_OFF");
  if (config.channel) await audit(actorId, "MESSAGING_CHANNEL", String(config.channel));
}

export async function saveTemplate(actorId: string, kind: unknown, input: { body?: unknown; waTemplate?: unknown }) {
  if (!MESSAGE_KINDS.includes(kind as MessageKind)) throw new MessagingError("That message is not known.", 404);
  const c = checkTemplate(input);
  if (!c.ok) throw new MessagingError(c.error);
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: "MESSAGING", scopeId: "" } } });
  const templates = { ...(((row?.config ?? {}) as Record<string, unknown>).templates as Record<string, unknown> | undefined) };
  templates[kind as string] = { body: c.body, waTemplate: c.waTemplate };
  await writeConfig(actorId, { config: { templates } });
  await audit(actorId, "MESSAGE_EDITED", String(kind));
}

export async function resetTemplate(actorId: string, kind: unknown) {
  if (!MESSAGE_KINDS.includes(kind as MessageKind)) throw new MessagingError("That message is not known.", 404);
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: "MESSAGING", scopeId: "" } } });
  const templates = { ...(((row?.config ?? {}) as Record<string, unknown>).templates as Record<string, unknown> | undefined) };
  delete templates[kind as string];
  await writeConfig(actorId, { config: { templates } });
  await audit(actorId, "MESSAGE_RESET", String(kind));
}

// ---------------------------------------------------------------- the engine

const CANDIDATE_LIMIT = 500;

async function firstModuleId(courseId: string) {
  return (await prisma.module.findFirst({ where: { courseId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } }))?.id ?? null;
}

type LeadRow = Awaited<ReturnType<typeof loadCandidates>>[number];

async function loadCandidates(now: Date, leadId?: string) {
  const since = new Date(now.getTime() - LEAD_WINDOW_DAYS * 24 * 3_600_000);
  return prisma.growthLead.findMany({
    where: { ...(leadId ? { id: leadId } : { createdAt: { gt: since } }), optedOutAt: null, OR: [{ phone: { not: null } }, { email: { not: null } }] },
    orderBy: { createdAt: "asc" },
    take: CANDIDATE_LIMIT,
    include: { messages: { select: { kind: true, status: true, sentAt: true, createdAt: true } }, play: { select: { nickname: true, score: true, questionIds: true, claimedAt: true, traineeId: true, campaign: { select: { slug: true, courseId: true, course: { select: { title: true } } } } } } },
  });
}

async function stateFor(lead: LeadRow) {
  const courseId = lead.play.campaign.courseId;
  let hasFullAccess = false;
  let module1Done = false;
  const traineeId = lead.traineeId ?? lead.play.traineeId;
  if (traineeId) {
    const enr = await prisma.courseEnrollment.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { unlockedAt: true, accessRevokedAt: true } });
    hasFullAccess = !!enr?.unlockedAt && !enr.accessRevokedAt;
    const m1 = await firstModuleId(courseId);
    module1Done = m1 ? !!(await prisma.moduleCompletion.findUnique({ where: { moduleId_traineeId: { moduleId: m1, traineeId } }, select: { id: true } })) : false;
  }
  const sent: SentRecord[] = lead.messages.map((m) => ({ kind: m.kind as MessageKind, at: m.sentAt ?? m.createdAt }));
  return {
    state: { createdAt: lead.createdAt, optedOutAt: lead.optedOutAt, claimedAt: lead.play.claimedAt, hasFullAccess, module1Done, hasPhone: !!lead.phone, hasEmail: !!lead.email },
    sent,
  };
}

function varsFor(lead: LeadRow, kind: MessageKind): RenderVars {
  const camp = lead.play.campaign;
  const total = (lead.play.questionIds as string[]).length;
  return {
    name: lead.play.nickname,
    rank: tasterRank(lead.play.score, total).label,
    course: camp.course.title,
    link: kind === "FINISH_MODULE_1" ? appUrl(`/trainee/courses/${camp.courseId}`) : appUrl(`/play/${camp.slug}/continue`),
    stop: appUrl(`/growth/optout/${lead.optOutToken}`),
  };
}

export interface ProcessResult { enabled: boolean; queued: number; sent: number; manual: number; failed: number; skipped: number; quiet: boolean; capped: boolean }

/** Works out who is due a message and sends it. Called by the hourly job, and right after someone saves their score. */
export async function processMessages(opts: { now?: Date; leadId?: string } = {}): Promise<ProcessResult> {
  const now = opts.now ?? new Date();
  const result: ProcessResult = { enabled: false, queued: 0, sent: 0, manual: 0, failed: 0, skipped: 0, quiet: false, capped: false };
  const settings = await getMessagingSettings();
  if (!settings.enabled) return result;
  result.enabled = true;

  // 1. Queue what is due.
  for (const lead of await loadCandidates(now, opts.leadId)) {
    const { state, sent } = await stateFor(lead);
    const kind = dueKind(state, sent, now);
    if (!kind) continue;
    const tpl = settings.templates[kind];
    try {
      await prisma.growthMessage.create({
        data: { leadId: lead.id, kind, channel: settings.channel, toPhone: lead.phone, toEmail: lead.email, body: renderMessage(tpl.body, varsFor(lead, kind)), status: "QUEUED", scheduledFor: now },
      });
      result.queued++;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // already queued by a parallel run
    }
  }

  // 2. Send what is queued, within quiet hours and the daily limit.
  result.quiet = inQuietHours(now, settings.quiet);
  if (result.quiet) return result;
  const sentLastDay = await prisma.growthMessage.count({ where: { sentAt: { gt: new Date(now.getTime() - 24 * 3_600_000) }, channel: { in: ["WHATSAPP", "EMAIL"] } } });
  let room = Math.max(0, settings.dailyCap - sentLastDay);
  const queued = await prisma.growthMessage.findMany({
    where: { status: "QUEUED", scheduledFor: { lte: now }, ...(opts.leadId ? { leadId: opts.leadId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { lead: { select: { optedOutAt: true, optOutToken: true, phone: true, email: true, play: { select: { nickname: true, score: true, questionIds: true, campaign: { select: { slug: true, courseId: true, course: { select: { title: true } } } } } } } } },
  });
  const waReady = await whatsAppConfigured();
  for (const m of queued) {
    if (m.lead.optedOutAt) { await finish(m.id, "SKIPPED", { error: "Opted out" }); result.skipped++; continue; }
    if (m.channel === "MANUAL") { await finish(m.id, "MANUAL_PENDING", {}); result.manual++; continue; }
    if (room <= 0) { result.capped = true; break; }
    const kind = m.kind as MessageKind;
    const tpl = settings.templates[kind];
    const vars: RenderVars = {
      name: m.lead.play.nickname, rank: tasterRank(m.lead.play.score, (m.lead.play.questionIds as string[]).length).label, course: m.lead.play.campaign.course.title,
      link: kind === "FINISH_MODULE_1" ? appUrl(`/trainee/courses/${m.lead.play.campaign.courseId}`) : appUrl(`/play/${m.lead.play.campaign.slug}/continue`),
      stop: appUrl(`/growth/optout/${m.lead.optOutToken}`),
    };
    if (m.channel === "WHATSAPP") {
      // Switched off (or credentials removed): leave it queued, to go when it is switched back on.
      if (!waReady) continue;
      if (!m.toPhone) { await finish(m.id, "SKIPPED", { error: "No phone number" }); result.skipped++; continue; }
      const r = await sendWhatsApp({ to: m.toPhone, templateName: tpl.waTemplate, variables: whatsAppVariables(vars) });
      if (r.ok) { await finish(m.id, "SENT", { providerMessageId: r.messageId ?? null, sentAt: now }); result.sent++; room--; } else { await finish(m.id, "FAILED", { error: r.error ?? "Could not send" }); result.failed++; }
    } else {
      if (!m.toEmail) { await finish(m.id, "SKIPPED", { error: "No email address" }); result.skipped++; continue; }
      const text = renderMessage(tpl.body, vars);
      const r = await sendEmail({ to: m.toEmail, subject: kind === "WELCOME" ? `Your ${vars.course} taster result` : `Your free Module 1 of ${vars.course}`, html: `<p>${escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`, text });
      if (r.ok) { await finish(m.id, "SENT", { sentAt: now }); result.sent++; room--; } else { await finish(m.id, "FAILED", { error: r.error ?? "Could not send" }); result.failed++; }
    }
  }
  return result;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function finish(id: string, status: MessageStatus, extra: { error?: string | null; providerMessageId?: string | null; sentAt?: Date }) {
  await prisma.growthMessage.update({ where: { id }, data: { status, error: extra.error ?? null, providerMessageId: extra.providerMessageId ?? undefined, sentAt: extra.sentAt ?? undefined } });
}

/** Right after a score is saved: the welcome can go out at once (quietly does nothing when messaging is off). */
export function queueForLead(leadId: string): void {
  void processMessages({ leadId }).catch((e) => console.error("growth messaging failed for a new lead", e));
}

// ---------------------------------------------------------------- what comes back from WhatsApp

/** Applies delivery updates and STOP replies. Returns what changed. */
export async function applyWebhook(parsed: ParsedWebhook): Promise<{ updated: number; optedOut: number }> {
  let updated = 0;
  for (const s of parsed.statuses) {
    const msg = await prisma.growthMessage.findFirst({ where: { providerMessageId: s.id }, select: { id: true, status: true } });
    if (!msg) continue;
    const next = nextStatus(msg.status as MessageStatus, s.status);
    if (next !== msg.status || s.error) {
      await prisma.growthMessage.update({ where: { id: msg.id }, data: { status: next, error: next === "FAILED" ? s.error ?? "Delivery failed" : undefined } });
      updated++;
    }
  }
  let optedOut = 0;
  if (parsed.optOutPhones.length) optedOut = (await prisma.growthLead.updateMany({ where: { phone: { in: parsed.optOutPhones }, optedOutAt: null }, data: { optedOutAt: new Date() } })).count;
  return { updated, optedOut };
}

// ---------------------------------------------------------------- the Super Admin's view

export async function messagingOverview() {
  const settings = await getMessagingSettings();
  const wa = await loadWhatsAppConfig();
  const [leads, withPhone, withEmail, optedOut, claimed, byStatus, sentLastDay, outbox] = await Promise.all([
    prisma.growthLead.count(),
    prisma.growthLead.count({ where: { phone: { not: null } } }),
    prisma.growthLead.count({ where: { email: { not: null } } }),
    prisma.growthLead.count({ where: { optedOutAt: { not: null } } }),
    prisma.growthLead.count({ where: { traineeId: { not: null } } }),
    prisma.growthMessage.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.growthMessage.count({ where: { sentAt: { gt: new Date(Date.now() - 24 * 3_600_000) }, channel: { in: ["WHATSAPP", "EMAIL"] } } }),
    prisma.growthMessage.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { lead: { select: { phone: true, email: true, optedOutAt: true } } } }),
  ]);
  return {
    settings: { enabled: settings.enabled, channel: settings.channel, dailyCap: settings.dailyCap, quiet: settings.quiet },
    providers: {
      whatsapp: { enabled: await whatsAppEnabled(), configured: await whatsAppConfigured() },
      email: { configured: !!process.env.RESEND_API_KEY },
      webhook: { url: appUrl("/api/webhooks/whatsapp"), verifyTokenSet: !!wa.verifyToken, appSecretSet: !!wa.appSecret },
    },
    templates: MESSAGE_KINDS.map((k) => ({ kind: k, label: KIND_LABEL[k], body: settings.templates[k].body, waTemplate: settings.templates[k].waTemplate, custom: settings.custom[k], metaText: metaTemplateText(settings.templates[k].body), defaultBody: DEFAULT_TEMPLATES[k].body })),
    counts: { leads, withPhone, withEmail, optedOut, claimed, sentLastDay, byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])) },
    outbox: outbox.map((m) => ({
      id: m.id, kind: m.kind, label: KIND_LABEL[m.kind as MessageKind] ?? m.kind, channel: m.channel, status: m.status, to: m.toPhone ?? m.toEmail ?? "", body: m.body, error: m.error, at: (m.sentAt ?? m.createdAt).toISOString(),
      optedOut: !!m.lead.optedOutAt, waMe: m.toPhone && (m.status === "MANUAL_PENDING" || m.status === "FAILED") ? waMeLink(m.toPhone, m.body) : null,
    })),
    quietNow: inQuietHours(new Date(), settings.quiet),
    defaultQuiet: DEFAULT_QUIET,
  };
}

export async function markManualSent(actorId: string, id: string) {
  const m = await prisma.growthMessage.findUnique({ where: { id }, select: { status: true } });
  if (!m) throw new MessagingError("That message was not found.", 404);
  if (m.status !== "MANUAL_PENDING") throw new MessagingError("Only a message waiting to be sent by hand can be marked sent.", 409);
  await prisma.growthMessage.update({ where: { id }, data: { status: "MANUAL_SENT", sentAt: new Date() } });
  await audit(actorId, "MESSAGE_SENT_BY_HAND", id);
}

export async function skipMessage(actorId: string, id: string) {
  const m = await prisma.growthMessage.findUnique({ where: { id }, select: { status: true } });
  if (!m) throw new MessagingError("That message was not found.", 404);
  if (!["QUEUED", "MANUAL_PENDING", "FAILED"].includes(m.status)) throw new MessagingError("That message has already gone out.", 409);
  await prisma.growthMessage.update({ where: { id }, data: { status: "SKIPPED", error: "Skipped by Super Admin" } });
  await audit(actorId, "MESSAGE_SKIPPED", id);
}

export async function retryMessage(actorId: string, id: string) {
  const m = await prisma.growthMessage.findUnique({ where: { id }, select: { status: true, lead: { select: { optedOutAt: true } } } });
  if (!m) throw new MessagingError("That message was not found.", 404);
  if (m.status !== "FAILED") throw new MessagingError("Only a failed message can be retried.", 409);
  if (m.lead.optedOutAt) throw new MessagingError("That person opted out.", 409);
  await prisma.growthMessage.update({ where: { id }, data: { status: "QUEUED", error: null, scheduledFor: new Date() } });
  await audit(actorId, "MESSAGE_RETRIED", id);
}

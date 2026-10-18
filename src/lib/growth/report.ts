import { prisma } from "@/lib/prisma";
import { organizationOfCourse } from "@/lib/arena/config";
import {
  LEDGER_ROWS_SHOWN, canMove, cleanNote, commissionKobo, funnelSteps, maskName, sourceLabel, summarizeLedger, periodStart, type FunnelCounts, type LedgerStatus, type Period,
} from "@/lib/growth/reportCore";

export class ReportError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------- attributing payments to campaigns

type GrantRow = { traineeId: string; courseId: string; campaignId: string; createdAt: Date };

/** Confirmed payments by people who came through a campaign, paid at or after the moment they did. */
async function attributedPayments(grants: GrantRow[]) {
  const out: { id: string; reference: string; traineeId: string; courseId: string; amountKobo: number; confirmedAt: Date; campaignId: string }[] = [];
  for (let i = 0; i < grants.length; i += 150) {
    const chunk = grants.slice(i, i + 150);
    const rows = await prisma.payment.findMany({
      where: { status: "SUCCESS", confirmedAt: { not: null }, OR: chunk.map((g) => ({ traineeId: g.traineeId, courseId: g.courseId, confirmedAt: { gte: g.createdAt } })) },
      select: { id: true, reference: true, traineeId: true, courseId: true, amountKobo: true, confirmedAt: true },
    });
    for (const p of rows) {
      const g = chunk.find((x) => x.traineeId === p.traineeId && x.courseId === p.courseId);
      if (g && p.confirmedAt) out.push({ ...p, confirmedAt: p.confirmedAt, campaignId: g.campaignId });
    }
  }
  return out;
}

async function organizationRate(organizationId: string | null): Promise<number> {
  if (!organizationId) return 0;
  const row = await prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType: "ORGANIZATION", scopeId: organizationId } }, select: { commissionBps: true } });
  return row?.commissionBps ?? 0;
}

/** Makes the ledger row for one attributed payment, once. Returns what happened. */
async function recordOne(p: { id: string; traineeId: string; courseId: string; amountKobo: number; confirmedAt: Date; campaignId: string }): Promise<"created" | "no-org" | "no-rate" | "exists"> {
  if (await prisma.growthCommission.findUnique({ where: { paymentId: p.id }, select: { id: true } })) return "exists";
  const { organizationId } = await organizationOfCourse(p.courseId);
  if (!organizationId) return "no-org";
  const rate = await organizationRate(organizationId);
  if (rate <= 0) return "no-rate";
  const play = await prisma.growthGuestPlay.findFirst({ where: { traineeId: p.traineeId, campaignId: p.campaignId }, orderBy: { claimedAt: "desc" }, select: { source: true } });
  try {
    await prisma.growthCommission.create({
      data: { paymentId: p.id, campaignId: p.campaignId, courseId: p.courseId, organizationId, traineeId: p.traineeId, source: play?.source ?? null, amountKobo: p.amountKobo, rateBps: rate, commissionKobo: commissionKobo(p.amountKobo, rate), paidAt: p.confirmedAt },
    });
    return "created";
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return "exists";
    throw e;
  }
}

/** Called the moment a payment is confirmed, so the rate frozen on the row is the rate at the time. Best effort: the report catches up on anything missed. */
export async function recordCommissionForPayment(reference: string): Promise<void> {
  const pay = await prisma.payment.findUnique({ where: { reference }, select: { id: true, traineeId: true, courseId: true, amountKobo: true, status: true, confirmedAt: true } });
  if (!pay || pay.status !== "SUCCESS" || !pay.confirmedAt) return;
  const grant = await prisma.growthGrant.findUnique({ where: { traineeId_courseId: { traineeId: pay.traineeId, courseId: pay.courseId } }, select: { campaignId: true, createdAt: true } });
  if (!grant || pay.confirmedAt < grant.createdAt) return;
  await recordOne({ id: pay.id, traineeId: pay.traineeId, courseId: pay.courseId, amountKobo: pay.amountKobo, confirmedAt: pay.confirmedAt, campaignId: grant.campaignId });
}

/** Makes ledger rows for any attributed payments that do not have one yet (a rate set after the payment, or a missed hook). Returns how many were made. */
export async function syncCommissions(campaignIds?: string[]): Promise<number> {
  const grants = await prisma.growthGrant.findMany({ where: campaignIds ? { campaignId: { in: campaignIds } } : undefined, select: { traineeId: true, courseId: true, campaignId: true, createdAt: true }, take: 5000 });
  if (grants.length === 0) return 0;
  const payments = await attributedPayments(grants);
  if (payments.length === 0) return 0;
  const have = new Set((await prisma.growthCommission.findMany({ where: { paymentId: { in: payments.map((p) => p.id) } }, select: { paymentId: true } })).map((r) => r.paymentId));
  let created = 0;
  for (const p of payments) if (!have.has(p.id) && (await recordOne(p)) === "created") created++;
  return created;
}

// ---------------------------------------------------------------- who may see what

export interface Viewer { userId: string; role: string }
export interface ScopeChoice { organizationId?: string | null; all?: boolean }

async function campaignsInScope(viewer: Viewer, choice: ScopeChoice) {
  const isSuper = viewer.role === "SUPER_ADMIN";
  let where: Record<string, unknown>;
  if (!isSuper) where = { course: { createdById: viewer.userId } };
  else if (choice.organizationId === null) where = { course: { createdBy: { trainingOrgAsStaffUser: null } } };
  else if (choice.organizationId) {
    const org = await prisma.trainingOrganization.findUnique({ where: { id: choice.organizationId }, select: { staffUserId: true } });
    if (!org?.staffUserId) throw new ReportError("That organization has no courses.", 404);
    where = { course: { createdById: org.staffUserId } };
  } else where = {};
  return prisma.growthCampaign.findMany({ where, select: { id: true, courseId: true, slug: true, course: { select: { title: true, createdById: true } } }, take: 500 });
}

// ---------------------------------------------------------------- the report

export async function campaignReport(viewer: Viewer, choice: ScopeChoice, period: Period, now = new Date()) {
  const isSuper = viewer.role === "SUPER_ADMIN";
  const campaigns = await campaignsInScope(viewer, choice);
  const campaignIds = campaigns.map((c) => c.id);
  await syncCommissions(campaignIds);
  const from = periodStart(period, now);

  const orgs = await prisma.trainingOrganization.findMany({ where: { approvalState: "APPROVED" }, select: { id: true, name: true, staffUserId: true }, orderBy: { name: "asc" } });
  const orgByStaff = new Map(orgs.filter((o) => o.staffUserId).map((o) => [o.staffUserId as string, o]));
  const rates = await prisma.growthSetting.findMany({ where: { scopeType: "ORGANIZATION" }, select: { scopeId: true, commissionBps: true } });
  const rateOf = new Map(rates.map((r) => [r.scopeId, r.commissionBps]));

  const [plays, grants] = await Promise.all([
    prisma.growthGuestPlay.findMany({ where: { campaignId: { in: campaignIds }, ...(from ? { startedAt: { gte: from } } : {}) }, select: { id: true, campaignId: true, source: true, completedAt: true, traineeId: true, duelOfId: true, lead: { select: { id: true, optedOutAt: true } } } }),
    prisma.growthGrant.findMany({ where: { campaignId: { in: campaignIds }, ...(from ? { createdAt: { gte: from } } : {}) }, select: { traineeId: true, courseId: true, campaignId: true, createdAt: true } }),
  ]);

  // Module 1 passed: the course's first module is completed.
  const courseIds = [...new Set(campaigns.map((c) => c.courseId))];
  const firstModules = new Map<string, string>();
  for (const cid of courseIds) {
    const m = await prisma.module.findFirst({ where: { courseId: cid }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } });
    if (m) firstModules.set(cid, m.id);
  }
  const completions = grants.length ? await prisma.moduleCompletion.findMany({ where: { moduleId: { in: [...firstModules.values()] }, traineeId: { in: grants.map((g) => g.traineeId) } }, select: { moduleId: true, traineeId: true } }) : [];
  const passedKey = new Set(completions.map((c) => `${c.traineeId}|${c.moduleId}`));
  const passed = (g: GrantRow) => passedKey.has(`${g.traineeId}|${firstModules.get(g.courseId)}`);

  const payments = await attributedPayments(grants);
  const paidKey = new Set(payments.map((p) => `${p.traineeId}|${p.courseId}`));
  const paid = (g: GrantRow) => paidKey.has(`${g.traineeId}|${g.courseId}`);

  // The play each grant came through, for the source of Module 1 starts and payments.
  const claimed = grants.length ? await prisma.growthGuestPlay.findMany({ where: { campaignId: { in: campaignIds }, traineeId: { in: grants.map((g) => g.traineeId) } }, select: { traineeId: true, campaignId: true, source: true, claimedAt: true }, orderBy: { claimedAt: "desc" } }) : [];
  const sourceOfGrant = (g: GrantRow) => claimed.find((p) => p.traineeId === g.traineeId && p.campaignId === g.campaignId)?.source ?? null;

  const zero = (): FunnelCounts => ({ started: 0, finished: 0, saved: 0, startedModule1: 0, passedModule1: 0, paid: 0 });
  const total = zero();
  const bySource = new Map<string, FunnelCounts>();
  const byCampaign = new Map<string, FunnelCounts>();
  const bump = (m: Map<string, FunnelCounts>, k: string, f: keyof FunnelCounts) => { const c = m.get(k) ?? zero(); c[f]++; m.set(k, c); };
  const add = (f: keyof FunnelCounts, source: string, campaignId: string) => { total[f]++; bump(bySource, sourceLabel(source || null), f); bump(byCampaign, campaignId, f); };
  for (const p of plays) {
    add("started", p.source ?? "", p.campaignId);
    if (p.completedAt) add("finished", p.source ?? "", p.campaignId);
    if (p.lead) add("saved", p.source ?? "", p.campaignId);
  }
  for (const g of grants) {
    const src = sourceOfGrant(g) ?? "";
    add("startedModule1", src, g.campaignId);
    if (passed(g)) add("passedModule1", src, g.campaignId);
    if (paid(g)) add("paid", src, g.campaignId);
  }

  // The ledger covers payments made in the period.
  const ledger = await prisma.growthCommission.findMany({ where: { campaignId: { in: campaignIds }, ...(from ? { paidAt: { gte: from } } : {}) }, orderBy: { paidAt: "desc" }, take: 2000 });
  const summary = summarizeLedger(ledger);
  const traineeNames = await prisma.trainee.findMany({ where: { id: { in: [...new Set(ledger.slice(0, LEDGER_ROWS_SHOWN).map((r) => r.traineeId))] } }, select: { id: true, name: true } });
  const nameOf = new Map(traineeNames.map((t) => [t.id, t.name]));
  const refs = isSuper ? await prisma.payment.findMany({ where: { id: { in: ledger.slice(0, LEDGER_ROWS_SHOWN).map((r) => r.paymentId) } }, select: { id: true, reference: true } }) : [];
  const refOf = new Map(refs.map((r) => [r.id, r.reference]));
  const titleOf = new Map(campaigns.map((c) => [c.courseId, c.course.title]));
  const orgName = (id: string | null) => orgs.find((o) => o.id === id)?.name ?? null;

  // Paid people on organization courses who have no ledger row, because the organization has no commission rate yet.
  const ledgered = new Set((await prisma.growthCommission.findMany({ where: { paymentId: { in: payments.map((p) => p.id) } }, select: { paymentId: true } })).map((r) => r.paymentId));
  const unrated = { count: 0, amountKobo: 0 };
  for (const p of payments) {
    if (ledgered.has(p.id)) continue;
    const camp = campaigns.find((c) => c.id === p.campaignId);
    if (camp && orgByStaff.has(camp.course.createdById)) { unrated.count++; unrated.amountKobo += p.amountKobo; }
  }

  const squads = await prisma.growthSquad.count({ where: { campaignId: { in: campaignIds }, ...(from ? { createdAt: { gte: from } } : {}) } });
  const leadIds = plays.filter((p) => p.lead).map((p) => p.lead!.id);
  const messageGroups = leadIds.length ? await prisma.growthMessage.groupBy({ by: ["status"], where: { leadId: { in: leadIds } }, _count: { _all: true } }) : [];
  const msgCount = (...s: string[]) => messageGroups.filter((g) => s.includes(g.status)).reduce((a, g) => a + g._count._all, 0);

  const courseRows = campaigns.map((c) => {
    const f = byCampaign.get(c.id) ?? zero();
    const org = orgByStaff.get(c.course.createdById);
    const rows = ledger.filter((r) => r.campaignId === c.id);
    return { courseId: c.courseId, title: c.course.title, organization: org?.name ?? null, funnel: f, earnedKobo: summarizeLedger(rows).earnedKobo };
  }).sort((a, b) => b.funnel.started - a.funnel.started);

  return {
    period, scope: { kind: !isSuper ? "OWN" : choice.organizationId === null ? "AAICBI" : choice.organizationId ? "ORG" : "ALL", organization: choice.organizationId ? orgName(choice.organizationId) : null },
    organizations: isSuper ? orgs.map((o) => ({ id: o.id, name: o.name })) : [],
    campaigns: campaigns.length,
    funnel: funnelSteps(total),
    extras: { scholarships: await prisma.growthScholarship.count({ where: { campaignId: { in: campaignIds }, status: "AWARDED", ...(from ? { awardedAt: { gte: from } } : {}) } }), squads, challenges: plays.filter((p) => p.duelOfId).length, optedOut: plays.filter((p) => p.lead?.optedOutAt).length, messagesSent: msgCount("SENT", "DELIVERED", "READ", "MANUAL_SENT"), messagesDelivered: msgCount("DELIVERED", "READ"), messagesFailed: msgCount("FAILED") },
    sources: [...bySource.entries()].map(([label, f]) => ({ label, funnel: f })).sort((a, b) => b.funnel.started - a.funnel.started),
    courses: courseRows,
    commission: {
      summary, unrated,
      rates: orgs.filter((o) => (isSuper || campaigns.some((c) => c.course.createdById === o.staffUserId))).map((o) => ({ organizationId: o.id, name: o.name, percent: rateOf.get(o.id) == null ? null : (rateOf.get(o.id) as number) / 100 })).filter((r) => isSuper ? r.percent !== null : true),
      ledgerShown: Math.min(ledger.length, LEDGER_ROWS_SHOWN), ledgerTotal: ledger.length,
      ledger: ledger.slice(0, LEDGER_ROWS_SHOWN).map((r) => ({
        id: r.id, paidAt: r.paidAt.toISOString(), trainee: maskName(nameOf.get(r.traineeId)), course: titleOf.get(r.courseId) ?? "A course", organization: orgName(r.organizationId), source: sourceLabel(r.source),
        amountKobo: r.amountKobo, rateBps: r.rateBps, commissionKobo: r.commissionKobo, status: r.status as LedgerStatus, note: r.note, settledAt: r.settledAt?.toISOString() ?? null, reference: refOf.get(r.paymentId) ?? null,
      })),
    },
    canSettle: isSuper,
  };
}

/** The whole ledger for a scope and period as plain rows, for the CSV. */
export async function ledgerForCsv(viewer: Viewer, choice: ScopeChoice, period: Period, now = new Date()) {
  const campaigns = await campaignsInScope(viewer, choice);
  await syncCommissions(campaigns.map((c) => c.id));
  const from = periodStart(period, now);
  const rows = await prisma.growthCommission.findMany({ where: { campaignId: { in: campaigns.map((c) => c.id) }, ...(from ? { paidAt: { gte: from } } : {}) }, orderBy: { paidAt: "desc" }, take: 10000 });
  const trainees = await prisma.trainee.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.traineeId))] } }, select: { id: true, name: true } });
  const orgs = await prisma.trainingOrganization.findMany({ select: { id: true, name: true } });
  const refs = viewer.role === "SUPER_ADMIN" ? await prisma.payment.findMany({ where: { id: { in: rows.map((r) => r.paymentId) } }, select: { id: true, reference: true } }) : [];
  const titles = new Map(campaigns.map((c) => [c.courseId, c.course.title]));
  return rows.map((r) => ({
    paidAt: r.paidAt.toISOString().slice(0, 10), organization: orgs.find((o) => o.id === r.organizationId)?.name ?? "", course: titles.get(r.courseId) ?? "", trainee: maskName(trainees.find((t) => t.id === r.traineeId)?.name),
    source: sourceLabel(r.source), amountNaira: r.amountKobo / 100, ratePercent: r.rateBps / 100, commissionNaira: r.commissionKobo / 100, status: r.status, note: r.note ?? "", reference: refs.find((x) => x.id === r.paymentId)?.reference ?? "",
  }));
}

// ---------------------------------------------------------------- settling (Super Admin only)

async function audit(actorId: string, action: string, detail: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType: "COMMISSION", scopeId: "", detail: detail.slice(0, 300) } });
}

/** Marks owed rows as settled: chosen rows, or every owed row of one organization. */
export async function settleCommissions(actorId: string, input: { ids?: string[]; organizationId?: string; note?: unknown }) {
  const note = cleanNote(input.note);
  const where = input.ids?.length ? { id: { in: input.ids }, status: "OWED" } : input.organizationId ? { organizationId: input.organizationId, status: "OWED" } : null;
  if (!where) throw new ReportError("Choose which commissions to settle.");
  const rows = await prisma.growthCommission.findMany({ where, select: { id: true, commissionKobo: true } });
  if (rows.length === 0) throw new ReportError("There is nothing owed to settle there.", 409);
  await prisma.growthCommission.updateMany({ where: { id: { in: rows.map((r) => r.id) }, status: "OWED" }, data: { status: "SETTLED", settledAt: new Date(), settledById: actorId, note } });
  await audit(actorId, "COMMISSION_SETTLED", `${rows.length} rows, ${rows.reduce((a, r) => a + r.commissionKobo, 0) / 100} naira${note ? `, ${note}` : ""}`);
  return rows.length;
}

/** Reopens a settled row, or reverses a row (the payment was refunded, which is done in Paystack: nothing here sees refunds). */
export async function moveCommission(actorId: string, id: string, to: LedgerStatus, note?: unknown) {
  const row = await prisma.growthCommission.findUnique({ where: { id }, select: { status: true } });
  if (!row) throw new ReportError("That commission was not found.", 404);
  if (!canMove(row.status, to)) throw new ReportError(row.status === "REVERSED" ? "A reversed commission stays reversed." : "That change is not possible for this commission.", 409);
  const n = cleanNote(note);
  if (to === "REVERSED" && !n) throw new ReportError("Say why it is being reversed, for example the refund reference.");
  const data = to === "REVERSED" ? { status: "REVERSED", reversedAt: new Date(), note: n } : to === "OWED" ? { status: "OWED", settledAt: null, settledById: null } : { status: "SETTLED", settledAt: new Date(), settledById: actorId, note: n };
  await prisma.growthCommission.update({ where: { id }, data });
  await audit(actorId, to === "REVERSED" ? "COMMISSION_REVERSED" : to === "OWED" ? "COMMISSION_REOPENED" : "COMMISSION_SETTLED", `${id}${n ? `, ${n}` : ""}`);
}

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { shuffle } from "@/lib/shuffle";
import { organizationOfCourse } from "@/lib/arena/config";
import { hasAvailableTrainingSeat } from "@/lib/trainingOrgSeatCap";
import {
  CONSENT_TEXT, TASTER_SIZE, beatPercent, checkLead, cleanSource, readinessIssues, slugify, switchBlockers, tasterRank,
  type GrowthScope, type SwitchRow,
} from "@/lib/growth/growthCore";

/** Practice questions that can be served to a newcomer: approved, reviewed, with exactly one correct option. The assessment pool is never used. */
const practiceWhere = (moduleId: string) => ({ exam: { moduleId }, bankStatus: "APPROVED" as const, bankPool: "PRACTICE" as const, bankObjectiveId: { not: null }, needsReview: false });

export class GrowthError extends Error {
  constructor(message: string, public status = 400, public issues?: string[]) {
    super(message);
  }
}

// ---------------------------------------------------------------- switches

export async function settingRow(scopeType: GrowthScope, scopeId = "") {
  return prisma.growthSetting.findUnique({ where: { scopeType_scopeId: { scopeType, scopeId } } });
}

async function audit(actorId: string, action: string, scopeType: string, scopeId: string, detail?: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType, scopeId, detail: detail?.slice(0, 300) ?? null } });
}

export async function setGlobalSwitch(actorId: string, scope: "PLATFORM" | "OWN" | "ORGS", enabled: boolean) {
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: scope, scopeId: "" } },
    create: { scopeType: scope, scopeId: "", enabled, updatedById: actorId },
    update: { enabled, updatedById: actorId },
  });
  await audit(actorId, enabled ? "SWITCH_ON" : "SWITCH_OFF", scope, "");
}

export interface OrgPatch { enabled?: boolean; agree?: boolean; commissionBps?: number | null; scholarshipEnabled?: boolean }

/** Changes one organization's row. Turning it on needs the agreement: already recorded, or recorded now by ticking it. */
export async function setOrganization(actorId: string, organizationId: string, patch: OrgPatch) {
  const org = await prisma.trainingOrganization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!org) throw new GrowthError("That organization could not be found.", 404);
  const existing = await settingRow("ORGANIZATION", organizationId);
  const data: Record<string, unknown> = { updatedById: actorId };
  let agreementAt = existing?.agreementAt ?? null;
  if (patch.agree && !agreementAt) {
    agreementAt = new Date();
    data.agreementAt = agreementAt;
    data.agreementById = actorId;
  }
  if (patch.enabled === true && !agreementAt) throw new GrowthError("Record the organization's agreement before switching it on.", 409);
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.commissionBps !== undefined) data.commissionBps = patch.commissionBps;
  if (patch.scholarshipEnabled !== undefined) data.scholarshipEnabled = patch.scholarshipEnabled;
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: "ORGANIZATION", scopeId: organizationId } },
    create: { scopeType: "ORGANIZATION", scopeId: organizationId, enabled: patch.enabled ?? false, agreementAt: (data.agreementAt as Date) ?? null, agreementById: (data.agreementById as string) ?? null, commissionBps: patch.commissionBps ?? null, scholarshipEnabled: patch.scholarshipEnabled ?? false, updatedById: actorId },
    update: data,
  });
  if (patch.agree && !existing?.agreementAt) await audit(actorId, "AGREEMENT_RECORDED", "ORGANIZATION", organizationId, org.name);
  if (patch.enabled !== undefined) await audit(actorId, patch.enabled ? "SWITCH_ON" : "SWITCH_OFF", "ORGANIZATION", organizationId, org.name);
  if (patch.commissionBps !== undefined) await audit(actorId, "COMMISSION_SET", "ORGANIZATION", organizationId, `${org.name}: ${patch.commissionBps == null ? "cleared" : patch.commissionBps / 100 + "%"}`);
  if (patch.scholarshipEnabled !== undefined) await audit(actorId, patch.scholarshipEnabled ? "SCHOLARSHIPS_ON" : "SCHOLARSHIPS_OFF", "ORGANIZATION", organizationId, org.name);
}

// ---------------------------------------------------------------- readiness

async function firstModule(courseId: string) {
  return prisma.module.findFirst({ where: { courseId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } });
}

/** The practice questions of module 1 that are valid to serve. */
export async function usableQuestions(moduleId: string) {
  const qs = await prisma.question.findMany({
    where: practiceWhere(moduleId),
    select: { id: true, text: true, explanation: true, bankObjective: { select: { text: true } }, options: { select: { key: true, text: true, isCorrect: true }, orderBy: { order: "asc" } } },
  });
  return qs.filter((q) => q.options.length >= 2 && q.options.filter((o) => o.isCorrect).length === 1);
}

export async function readiness(courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { status: true, growthCampaign: { select: { id: true } } } });
  if (!course) throw new GrowthError("Course not found.", 404);
  const mod = await firstModule(courseId);
  const [assessment, usable, taster] = await Promise.all([
    mod ? prisma.exam.findFirst({ where: { moduleId: mod.id }, select: { id: true } }) : null,
    mod ? usableQuestions(mod.id) : [],
    course.growthCampaign ? prisma.growthTasterQuestion.findMany({ where: { campaignId: course.growthCampaign.id, status: "APPROVED" }, select: { questionId: true } }) : [],
  ]);
  const ok = new Set(usable.map((q) => q.id));
  const issues = readinessIssues({
    published: course.status === "PUBLISHED",
    hasModule: !!mod,
    hasAssessment: !!assessment,
    usableQuestions: usable.length,
    approvedTaster: taster.length,
    approvedStillUsable: taster.filter((t) => ok.has(t.questionId)).length,
  });
  return { issues, ready: issues.length === 0, moduleTitle: mod?.title ?? null, usable: usable.length, approved: taster.length };
}

// ---------------------------------------------------------------- campaigns

async function uniqueSlug(title: string) {
  const base = slugify(title);
  for (let n = 0; n < 20; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    if (!(await prisma.growthCampaign.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${base}-${randomBytes(3).toString("hex")}`;
}

export async function ensureCampaign(courseId: string) {
  const existing = await prisma.growthCampaign.findUnique({ where: { courseId } });
  if (existing) return existing;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) throw new GrowthError("Course not found.", 404);
  const orgId = (await organizationOfCourse(courseId)).organizationId;
  let name = "";
  if (orgId) name = (await prisma.trainingOrganization.findUnique({ where: { id: orgId }, select: { name: true } }))?.name ?? "";
  return prisma.growthCampaign.create({ data: { courseId, slug: await uniqueSlug(`${name} ${course.title}`.trim()) } });
}

/** Where a course stands: the switches, readiness, and so whether its public link is live. */
export async function courseGrowth(courseId: string) {
  const { organizationId } = await organizationOfCourse(courseId);
  const [platform, own, orgs, organization, campaign, ready] = await Promise.all([
    settingRow("PLATFORM"), settingRow("OWN"), settingRow("ORGS"),
    organizationId ? settingRow("ORGANIZATION", organizationId) : null,
    prisma.growthCampaign.findUnique({ where: { courseId } }),
    readiness(courseId),
  ]);
  const blockers = switchBlockers({ platform, own, orgs, organization, organizationId, campaignEnabled: !!campaign?.enabled });
  const issues = [...blockers, ...ready.issues];
  return { organizationId, campaign, readiness: ready, blockers, live: issues.length === 0, issues };
}

export async function setCourseOptIn(actorId: string, courseId: string, enabled: boolean) {
  if (enabled) {
    const r = await readiness(courseId);
    if (!r.ready) throw new GrowthError("This course is not ready yet.", 409, r.issues);
  }
  const campaign = await ensureCampaign(courseId);
  await prisma.growthCampaign.update({ where: { id: campaign.id }, data: { enabled } });
  await audit(actorId, enabled ? "COURSE_ON" : "COURSE_OFF", "COURSE", courseId, campaign.slug);
}

export async function campaignBySlug(slug: string) {
  return prisma.growthCampaign.findUnique({ where: { slug }, select: { id: true, slug: true, courseId: true, course: { select: { id: true, title: true, description: true } } } });
}

/** The page's facts: the campaign, who runs the course, and whether the link is live right now. */
export async function publicCampaign(slug: string) {
  const c = await campaignBySlug(slug);
  if (!c) return null;
  const g = await courseGrowth(c.courseId);
  const orgName = g.organizationId ? (await prisma.trainingOrganization.findUnique({ where: { id: g.organizationId }, select: { name: true } }))?.name ?? null : null;
  return { id: c.id, slug: c.slug, courseId: c.courseId, courseTitle: c.course.title, organizationName: orgName, live: g.live };
}

// ---------------------------------------------------------------- the instructor's taster

export async function tasterView(courseId: string) {
  const campaign = await prisma.growthCampaign.findUnique({ where: { courseId }, include: { taster: { orderBy: { position: "asc" } } } });
  const mod = await firstModule(courseId);
  const usable = mod ? await usableQuestions(mod.id) : [];
  const byId = new Map(usable.map((q) => [q.id, q]));
  const questions = (campaign?.taster ?? []).map((t) => {
    const q = byId.get(t.questionId);
    return {
      questionId: t.questionId, position: t.position, status: t.status, stillUsable: !!q,
      text: q?.text ?? "This question is no longer available.", objective: q?.bankObjective?.text ?? null,
      options: q?.options.map((o) => ({ key: o.key, text: o.text, isCorrect: o.isCorrect })) ?? [],
    };
  });
  return {
    moduleTitle: mod?.title ?? null, available: usable.length, slug: campaign?.slug ?? null, enabled: !!campaign?.enabled,
    approvedAt: campaign?.tasterApprovedAt ?? null, questions,
  };
}

async function refreshApproval(campaignId: string, actorId: string) {
  const rows = await prisma.growthTasterQuestion.findMany({ where: { campaignId }, select: { status: true } });
  const all = rows.length === TASTER_SIZE && rows.every((r) => r.status === "APPROVED");
  const campaign = await prisma.growthCampaign.findUnique({ where: { id: campaignId }, select: { tasterApprovedAt: true, courseId: true } });
  if (all && !campaign?.tasterApprovedAt) {
    await prisma.growthCampaign.update({ where: { id: campaignId }, data: { tasterApprovedAt: new Date(), tasterApprovedById: actorId } });
    await audit(actorId, "TASTER_APPROVED", "COURSE", campaign?.courseId ?? "");
  } else if (!all && campaign?.tasterApprovedAt) {
    await prisma.growthCampaign.update({ where: { id: campaignId }, data: { tasterApprovedAt: null, tasterApprovedById: null, enabled: false } });
  }
}

/** Picks a fresh set of five from the module's usable practice questions, all waiting for approval. Switches the course off while it is being re-approved. */
export async function proposeTaster(actorId: string, courseId: string) {
  const mod = await firstModule(courseId);
  if (!mod) throw new GrowthError("This course has no module 1 yet.", 409);
  const usable = await usableQuestions(mod.id);
  if (usable.length < TASTER_SIZE) throw new GrowthError(`Module 1 needs at least ${TASTER_SIZE} approved practice questions and has ${usable.length}.`, 409);
  const campaign = await ensureCampaign(courseId);
  const picked = shuffle(usable).slice(0, TASTER_SIZE);
  await prisma.$transaction([
    prisma.growthTasterQuestion.deleteMany({ where: { campaignId: campaign.id } }),
    prisma.growthTasterQuestion.createMany({ data: picked.map((q, position) => ({ campaignId: campaign.id, questionId: q.id, position })) }),
    prisma.growthCampaign.update({ where: { id: campaign.id }, data: { tasterApprovedAt: null, tasterApprovedById: null, enabled: false } }),
  ]);
  await audit(actorId, "TASTER_PROPOSED", "COURSE", courseId);
}

export async function approveTasterQuestion(actorId: string, courseId: string, questionId: string) {
  const campaign = await prisma.growthCampaign.findUnique({ where: { courseId }, select: { id: true } });
  if (!campaign) throw new GrowthError("Propose a taster first.", 409);
  const row = await prisma.growthTasterQuestion.findUnique({ where: { campaignId_questionId: { campaignId: campaign.id, questionId } } });
  if (!row) throw new GrowthError("That question is not in the taster.", 404);
  const mod = await firstModule(courseId);
  const ok = mod ? (await usableQuestions(mod.id)).some((q) => q.id === questionId) : false;
  if (!ok) throw new GrowthError("That question is no longer available. Swap it for another.", 409);
  await prisma.growthTasterQuestion.update({ where: { id: row.id }, data: { status: "APPROVED", decidedById: actorId, decidedAt: new Date() } });
  await refreshApproval(campaign.id, actorId);
}

/** Replaces one taster question with another usable one that is not already in the taster. The new one waits for approval. */
export async function swapTasterQuestion(actorId: string, courseId: string, questionId: string) {
  const campaign = await prisma.growthCampaign.findUnique({ where: { courseId }, select: { id: true } });
  if (!campaign) throw new GrowthError("Propose a taster first.", 409);
  const row = await prisma.growthTasterQuestion.findUnique({ where: { campaignId_questionId: { campaignId: campaign.id, questionId } } });
  if (!row) throw new GrowthError("That question is not in the taster.", 404);
  const mod = await firstModule(courseId);
  const usable = mod ? await usableQuestions(mod.id) : [];
  const inUse = new Set((await prisma.growthTasterQuestion.findMany({ where: { campaignId: campaign.id }, select: { questionId: true } })).map((r) => r.questionId));
  const spare = usable.filter((q) => !inUse.has(q.id));
  if (spare.length === 0) throw new GrowthError("There are no other approved practice questions in module 1 to swap in.", 409);
  const next = spare[Math.floor(Math.random() * spare.length)];
  await prisma.growthTasterQuestion.update({ where: { id: row.id }, data: { questionId: next.id, status: "PENDING", decidedById: null, decidedAt: null } });
  await refreshApproval(campaign.id, actorId);
}

// ---------------------------------------------------------------- the newcomer's play

type Choice = { questionId: string; choice: string; correct: boolean };

export type PlayState =
  | { status: "question"; index: number; total: number; question: { id: string; text: string; options: { key: string; text: string }[] } }
  | { status: "done"; score: number; total: number; rank: { key: string; label: string }; grid: boolean[]; weakSpot: string | null; beatPercent: number | null };

async function servedQuestion(id: string) {
  const q = await prisma.question.findUnique({ where: { id }, select: { id: true, text: true, options: { select: { key: true, text: true } } } });
  if (!q) return null;
  return { id: q.id, text: q.text, options: shuffle(q.options) };
}

async function stateOf(play: { id: string; campaignId: string; questionIds: unknown; answers: unknown; score: number; completedAt: Date | null }): Promise<PlayState> {
  const ids = play.questionIds as string[];
  const answers = play.answers as Choice[];
  if (answers.length < ids.length) {
    const q = await servedQuestion(ids[answers.length]);
    if (q) return { status: "question", index: answers.length, total: ids.length, question: q };
  }
  const grid = answers.map((a) => a.correct);
  const missed = answers.find((a) => !a.correct);
  const weak = missed ? await prisma.question.findUnique({ where: { id: missed.questionId }, select: { bankObjective: { select: { text: true } } } }) : null;
  const finished = await prisma.growthGuestPlay.findMany({ where: { campaignId: play.campaignId, completedAt: { not: null } }, select: { score: true }, take: 2000 });
  return { status: "done", score: play.score, total: ids.length, rank: tasterRank(play.score, ids.length), grid, weakSpot: weak?.bankObjective?.text ?? null, beatPercent: beatPercent(play.score, finished.map((f) => f.score)) };
}

/** Starts a taster (or resumes one by its token). Starting needs the link to be live; a run already under way may finish. */
export async function playStart(slug: string, token: string | null, source: unknown): Promise<{ token: string; state: PlayState }> {
  const campaign = await campaignBySlug(slug);
  if (!campaign) throw new GrowthError("This link isn't available.", 404);
  if (token) {
    const play = await prisma.growthGuestPlay.findUnique({ where: { token } });
    if (play && play.campaignId === campaign.id) return { token, state: await stateOf(play) };
  }
  const g = await courseGrowth(campaign.courseId);
  if (!g.live) throw new GrowthError("This campaign has ended.", 410);
  const taster = await prisma.growthTasterQuestion.findMany({ where: { campaignId: campaign.id, status: "APPROVED" }, orderBy: { position: "asc" }, select: { questionId: true } });
  const play = await prisma.growthGuestPlay.create({
    data: { token: randomBytes(24).toString("hex"), campaignId: campaign.id, source: cleanSource(source), questionIds: taster.map((t) => t.questionId) },
  });
  return { token: play.token, state: await stateOf(play) };
}

/** Grades the answer to the question the play is on. The key is revealed only now, and only for that question. */
export async function playAnswer(slug: string, token: string, choice: unknown) {
  const campaign = await campaignBySlug(slug);
  if (!campaign) throw new GrowthError("This link isn't available.", 404);
  const play = await prisma.growthGuestPlay.findUnique({ where: { token } });
  if (!play || play.campaignId !== campaign.id) throw new GrowthError("Start again to play.", 404);
  const ids = play.questionIds as string[];
  const answers = play.answers as Choice[];
  if (answers.length >= ids.length) throw new GrowthError("You have already finished.", 409);
  if (typeof choice !== "string") throw new GrowthError("Choose one of the options.");
  const qid = ids[answers.length];
  const q = await prisma.question.findUnique({ where: { id: qid }, select: { explanation: true, options: { select: { key: true, isCorrect: true } } } });
  if (!q || !q.options.some((o) => o.key === choice)) throw new GrowthError("Choose one of the options.");
  const correctKey = q.options.find((o) => o.isCorrect)?.key ?? null;
  const correct = choice === correctKey;
  const nextAnswers = [...answers, { questionId: qid, choice, correct }];
  const done = nextAnswers.length === ids.length;
  const updated = await prisma.growthGuestPlay.updateMany({
    // The length check makes a repeated tap on the same question a no-op instead of a second answer.
    where: { id: play.id, answers: { equals: play.answers as object } },
    data: { answers: nextAnswers, score: nextAnswers.filter((a) => a.correct).length, completedAt: done ? new Date() : null },
  });
  if (updated.count === 0) throw new GrowthError("That answer was already counted.", 409);
  const fresh = await prisma.growthGuestPlay.findUniqueOrThrow({ where: { id: play.id } });
  return { correct, correctKey, explanation: q.explanation, state: await stateOf(fresh) };
}

// ---------------------------------------------------------------- saving a score

export async function saveLead(slug: string, token: string, input: { phone?: unknown; email?: unknown; consent?: unknown }) {
  const campaign = await campaignBySlug(slug);
  if (!campaign) throw new GrowthError("This link isn't available.", 404);
  const play = await prisma.growthGuestPlay.findUnique({ where: { token } });
  if (!play || play.campaignId !== campaign.id) throw new GrowthError("Start again to play.", 404);
  if (!play.completedAt) throw new GrowthError("Finish the five questions first.", 409);
  const check = checkLead(input);
  if (!check.ok) throw new GrowthError(check.error);
  const data = { phone: check.phone, email: check.email, consentAt: new Date(), consentText: CONSENT_TEXT, optedOutAt: null };
  const lead = await prisma.growthLead.upsert({
    where: { playId: play.id },
    create: { playId: play.id, campaignId: campaign.id, optOutToken: randomBytes(20).toString("hex"), ...data },
    update: data,
  });
  return { saved: true, phone: lead.phone, email: lead.email };
}

/** Stops all contact for a lead. Safe to repeat. */
export async function optOut(optOutToken: string): Promise<boolean> {
  const lead = await prisma.growthLead.findUnique({ where: { optOutToken }, select: { id: true, optedOutAt: true } });
  if (!lead) return false;
  if (!lead.optedOutAt) await prisma.growthLead.update({ where: { id: lead.id }, data: { optedOutAt: new Date() } });
  return true;
}

// ---------------------------------------------------------------- continuing into module 1

/** How many modules are open without payment for this trainee because they came through a campaign (0 when they did not). */
export async function grantedModules(traineeId: string, courseId: string): Promise<number> {
  const g = await prisma.growthGrant.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { modules: true } });
  return g?.modules ?? 0;
}

/**
 * A signed-in trainee continues from the taster. Their play is linked to their account, and they are enrolled with module 1 open
 * and the rest behind payment. A free course just enrolls them. Needs the campaign live unless they already came through it.
 */
export async function claimPlay(traineeId: string, slug: string, token: string | null) {
  const campaign = await campaignBySlug(slug);
  if (!campaign) throw new GrowthError("This link isn't available.", 404);
  const [existingGrant, existing] = await Promise.all([
    prisma.growthGrant.findUnique({ where: { traineeId_courseId: { traineeId, courseId: campaign.courseId } } }),
    prisma.courseEnrollment.findUnique({ where: { traineeId_courseId: { traineeId, courseId: campaign.courseId } } }),
  ]);
  if (existing?.accessRevokedAt) throw new GrowthError("Your access to this course was revoked. Contact a staff member if you believe this is a mistake.", 403);
  if (!existing && !existingGrant) {
    const g = await courseGrowth(campaign.courseId);
    if (!g.live) throw new GrowthError("This campaign has ended.", 410);
  }
  const course = await prisma.course.findUnique({ where: { id: campaign.courseId }, select: { isFree: true } });
  if (!course) throw new GrowthError("Course not found.", 404);

  if (token) {
    const play = await prisma.growthGuestPlay.findUnique({ where: { token }, select: { id: true, campaignId: true, traineeId: true } });
    if (play && play.campaignId === campaign.id && !play.traineeId) {
      await prisma.growthGuestPlay.update({ where: { id: play.id }, data: { traineeId, claimedAt: new Date() } });
      await prisma.growthLead.updateMany({ where: { playId: play.id }, data: { traineeId } });
    }
  }

  if (!existing) {
    if (course.isFree) {
      if (!(await hasAvailableTrainingSeat(campaign.courseId, traineeId))) throw new GrowthError("This organization has reached its trainee capacity. Contact AAICBI or the organization for more information.", 409);
      await prisma.courseEnrollment.create({ data: { traineeId, courseId: campaign.courseId, source: "FREE", unlockedAt: new Date() } });
    } else {
      await prisma.$transaction([
        prisma.courseEnrollment.create({ data: { traineeId, courseId: campaign.courseId, source: "PREVIEW" } }),
        prisma.growthGrant.upsert({ where: { traineeId_courseId: { traineeId, courseId: campaign.courseId } }, create: { traineeId, courseId: campaign.courseId, campaignId: campaign.id, modules: 1 }, update: {} }),
      ]);
    }
  } else if (!existingGrant && existing.source === "PREVIEW") {
    await prisma.growthGrant.upsert({ where: { traineeId_courseId: { traineeId, courseId: campaign.courseId } }, create: { traineeId, courseId: campaign.courseId, campaignId: campaign.id, modules: 1 }, update: {} });
  }
  return { courseId: campaign.courseId };
}

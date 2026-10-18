import { prisma } from "@/lib/prisma";
import { organizationOfCourse } from "@/lib/arena/config";
import { hasAvailableTrainingSeat } from "@/lib/trainingOrgSeatCap";
import { appUrl } from "@/lib/appUrl";
import { notifyByEmail, shouldNotifyTrainee } from "@/lib/notifications/log";
import { scholarshipAwardedEmail } from "@/lib/notifications/templates";
import { GrowthError, settingRow } from "@/lib/growth/growth";
import { cleanCount, scholarshipBlockers, seatState, MAX_SCHOLARSHIP_SEATS } from "@/lib/growth/growthCore";

async function audit(actorId: string, action: string, scopeType: string, scopeId: string, detail?: string) {
  await prisma.growthAudit.create({ data: { actorId, action, scopeType, scopeId, detail: detail?.slice(0, 300) ?? null } });
}

/** AAICBI's own courses: scholarship seats on or off for all of them. */
export async function setOwnScholarships(actorId: string, enabled: boolean) {
  await prisma.growthSetting.upsert({
    where: { scopeType_scopeId: { scopeType: "OWN", scopeId: "" } },
    create: { scopeType: "OWN", scopeId: "", enabled: false, scholarshipEnabled: enabled, updatedById: actorId },
    update: { scholarshipEnabled: enabled, updatedById: actorId },
  });
  await audit(actorId, enabled ? "SCHOLARSHIPS_ON" : "SCHOLARSHIPS_OFF", "OWN", "", "AAICBI courses");
}

/** Whether the switches allow new seats for a course, and the reasons when they do not. */
export async function scholarshipSwitches(courseId: string) {
  const { organizationId } = await organizationOfCourse(courseId);
  const [platform, own, orgs, organization] = await Promise.all([
    settingRow("PLATFORM"), settingRow("OWN"), settingRow("ORGS"),
    organizationId ? settingRow("ORGANIZATION", organizationId) : null,
  ]);
  const blockers = scholarshipBlockers({ platform, own, orgs, organization, organizationId, ownScholarships: !!own?.scholarshipEnabled, organizationScholarships: !!organization?.scholarshipEnabled });
  return { organizationId, blockers };
}

async function heldAndPlays(campaignId: string) {
  const [held, finishedPlays] = await Promise.all([
    prisma.growthScholarship.count({ where: { campaignId, status: "AWARDED" } }),
    prisma.growthGuestPlay.count({ where: { campaignId, completedAt: { not: null } } }),
  ]);
  return { held, finishedPlays };
}

/** What the Super Admin sees for one course: the settings, how many seats are used and who holds them. */
export async function scholarshipOverview(courseId: string) {
  const campaign = await prisma.growthCampaign.findUnique({ where: { courseId }, select: { id: true, scholarshipSeats: true, scholarshipMinPlays: true } });
  if (!campaign) return { seats: 0, minPlays: 0, held: 0, finishedPlays: 0, left: 0, open: false, reason: "No campaign yet.", blockers: [] as string[], recipients: [] as Recipient[] };
  const [{ held, finishedPlays }, sw, rows] = await Promise.all([
    heldAndPlays(campaign.id),
    scholarshipSwitches(courseId),
    prisma.growthScholarship.findMany({ where: { campaignId: campaign.id }, orderBy: { awardedAt: "desc" }, take: 200 }),
  ]);
  const state = seatState({ seats: campaign.scholarshipSeats, minPlays: campaign.scholarshipMinPlays, finishedPlays, held });
  const trainees = await prisma.trainee.findMany({ where: { id: { in: rows.map((r) => r.traineeId) } }, select: { id: true, name: true, email: true } });
  const byId = new Map(trainees.map((t) => [t.id, t]));
  const recipients: Recipient[] = rows.map((r) => ({ id: r.id, name: byId.get(r.traineeId)?.name ?? "A trainee", email: byId.get(r.traineeId)?.email ?? "", status: r.status, awardedAt: r.awardedAt.toISOString(), revokedAt: r.revokedAt?.toISOString() ?? null }));
  return { seats: campaign.scholarshipSeats, minPlays: campaign.scholarshipMinPlays, held, finishedPlays, left: state.left, open: state.open && sw.blockers.length === 0, reason: sw.blockers[0] ?? state.reason, blockers: sw.blockers, recipients };
}
export interface Recipient { id: string; name: string; email: string; status: string; awardedAt: string; revokedAt: string | null }

export async function setSeats(actorId: string, courseId: string, seatsIn: unknown, minPlaysIn: unknown) {
  const seats = cleanCount(seatsIn);
  const minPlays = cleanCount(minPlaysIn, 1_000_000);
  if (seats === null) throw new GrowthError(`Seats is a whole number from 0 to ${MAX_SCHOLARSHIP_SEATS}.`);
  if (minPlays === null) throw new GrowthError("The number of players must be a whole number.");
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) throw new GrowthError("Course not found.", 404);
  const existing = await prisma.growthCampaign.findUnique({ where: { courseId }, select: { id: true } });
  if (!existing) throw new GrowthError("Opt the course in first, so it has a campaign.", 409);
  const held = await prisma.growthScholarship.count({ where: { campaignId: existing.id, status: "AWARDED" } });
  if (seats < held) throw new GrowthError(`${held} seat${held === 1 ? " is" : "s are"} already given. Revoke one first to go lower.`, 409);
  await prisma.growthCampaign.update({ where: { id: existing.id }, data: { scholarshipSeats: seats, scholarshipMinPlays: minPlays } });
  await audit(actorId, "SEATS_SET", "COURSE", courseId, `${course.title}: ${seats} seats, opens after ${minPlays} players`);
}

/** Takes a seat back. The person keeps module 1 and goes back to paying for the rest. */
export async function revokeSeat(actorId: string, scholarshipId: string, note?: string) {
  const row = await prisma.growthScholarship.findUnique({ where: { id: scholarshipId } });
  if (!row) throw new GrowthError("That seat could not be found.", 404);
  if (row.status === "REVOKED") return;
  await prisma.$transaction([
    prisma.growthScholarship.update({ where: { id: row.id }, data: { status: "REVOKED", revokedAt: new Date(), revokedById: actorId, note: note?.slice(0, 200) ?? null } }),
    prisma.courseEnrollment.updateMany({ where: { traineeId: row.traineeId, courseId: row.courseId, source: "ADMIN_GRANTED", enrolledById: null }, data: { source: "PREVIEW", unlockedAt: null } }),
  ]);
  await audit(actorId, "SEAT_REVOKED", "COURSE", row.courseId, row.traineeId);
}

/** The scholarship a trainee holds for a course, when there is one. */
export async function heldScholarship(traineeId: string, courseId: string) {
  const row = await prisma.growthScholarship.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { status: true, awardedAt: true } });
  return row?.status === "AWARDED" ? { awardedAt: row.awardedAt.toISOString() } : null;
}

/**
 * Gives a seat to a trainee who came through the campaign and has passed module 1, while seats last and the pool is open.
 * Safe to call as often as you like: it only acts for the first qualifying call, and never re-awards a revoked seat.
 */
export async function awardIfEligible(traineeId: string, courseId: string): Promise<boolean> {
  const [grant, campaign] = await Promise.all([
    prisma.growthGrant.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { id: true } }),
    prisma.growthCampaign.findUnique({ where: { courseId }, select: { id: true, scholarshipSeats: true, scholarshipMinPlays: true } }),
  ]);
  if (!grant || !campaign || campaign.scholarshipSeats <= 0) return false;
  const [enrollment, existing, first] = await Promise.all([
    prisma.courseEnrollment.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { id: true, source: true, unlockedAt: true, accessRevokedAt: true } }),
    prisma.growthScholarship.findUnique({ where: { traineeId_courseId: { traineeId, courseId } }, select: { id: true } }),
    prisma.module.findFirst({ where: { courseId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } }),
  ]);
  if (existing || !first || !enrollment || enrollment.source !== "PREVIEW" || enrollment.unlockedAt || enrollment.accessRevokedAt) return false;
  const passed = await prisma.moduleCompletion.findFirst({ where: { traineeId, moduleId: first.id }, select: { id: true } });
  if (!passed) return false;
  if ((await scholarshipSwitches(courseId)).blockers.length > 0) return false;
  if (!(await hasAvailableTrainingSeat(courseId, traineeId))) return false;

  const awarded = await prisma.$transaction(async (tx) => {
    // One award at a time per campaign, so two people passing together cannot take the same last seat.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${campaign.id}))`;
    const [held, finishedPlays] = await Promise.all([
      tx.growthScholarship.count({ where: { campaignId: campaign.id, status: "AWARDED" } }),
      tx.growthGuestPlay.count({ where: { campaignId: campaign.id, completedAt: { not: null } } }),
    ]);
    if (!seatState({ seats: campaign.scholarshipSeats, minPlays: campaign.scholarshipMinPlays, finishedPlays, held }).open) return false;
    await tx.growthScholarship.create({ data: { traineeId, courseId, campaignId: campaign.id } });
    await tx.courseEnrollment.update({ where: { id: enrollment.id }, data: { source: "ADMIN_GRANTED", unlockedAt: new Date() } });
    return true;
  });
  if (awarded) void notifyAwarded(traineeId, courseId);
  return awarded;
}

async function notifyAwarded(traineeId: string, courseId: string) {
  try {
    const [trainee, course] = await Promise.all([
      prisma.trainee.findUnique({ where: { id: traineeId } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    ]);
    if (!trainee || !course || !shouldNotifyTrainee(trainee)) return;
    const url = `/trainee/courses/${courseId}`;
    const c = scholarshipAwardedEmail(trainee.name, course.title, appUrl(url));
    await notifyByEmail({ recipientType: "TRAINEE", recipientId: traineeId, to: trainee.email, type: "COURSE_ACCESS_GRANTED", relatedId: courseId, url, subject: c.subject, html: c.html, text: c.text });
  } catch (e) {
    console.error(`Failed to tell trainee ${traineeId} about their scholarship seat:`, e);
  }
}

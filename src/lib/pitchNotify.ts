/**
 * Pitch & Post, Phase 1 — the notification call sites shared across the
 * trainee, admin, and investor pitch routes. Each function here wraps
 * its own try/catch (matching every other notification call site in
 * this app — see notifyByEmail's own comment): a failed notification
 * must never break the request that triggered it.
 */
import { prisma } from "@/lib/prisma";
import { notifyByEmail } from "@/lib/notifications/log";
import {
  pitchSubmittedEmail,
  pitchNeedsRevisionEmail,
  pitchApprovedEmail,
  pitchRejectedEmail,
  pitchPublishedEmail,
  pitchDisclosureRequestedEmail,
  pitchDisclosureResponseEmail,
  pitchInterestReceivedEmail,
} from "@/lib/notifications/templates";
import { appUrl } from "@/lib/appUrl";

export async function notifyAdminsOfPitchSubmitted(pitchId: string, startupName: string, founderName: string) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true, email: true },
    });
    const content = pitchSubmittedEmail(founderName, startupName, appUrl(`/admin/pitches/${pitchId}`));
    for (const admin of admins) {
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: admin.id,
        to: admin.email,
        type: "PITCH_SUBMITTED",
        relatedId: pitchId,
        url: `/admin/pitches/${pitchId}`,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    }
  } catch (e) {
    console.error(`Pitch submission notification failed for pitch ${pitchId}:`, e);
  }
}

async function founderContact(traineeId: string) {
  return prisma.trainee.findUnique({ where: { id: traineeId }, select: { name: true, email: true } });
}

export async function notifyFounderOfNeedsRevision(pitchId: string, traineeId: string, startupName: string, note: string, threadUrl: string) {
  try {
    const founder = await founderContact(traineeId);
    if (!founder) return;
    const content = pitchNeedsRevisionEmail(startupName, note, appUrl(threadUrl));
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: founder.email,
      type: "PITCH_NEEDS_REVISION",
      relatedId: pitchId,
      url: threadUrl,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (e) {
    console.error(`Pitch needs-revision notification failed for pitch ${pitchId}:`, e);
  }
}

export async function notifyFounderOfApproval(pitchId: string, traineeId: string, startupName: string) {
  try {
    const founder = await founderContact(traineeId);
    if (!founder) return;
    const content = pitchApprovedEmail(startupName, appUrl(`/trainee/pitch/${pitchId}`));
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: founder.email,
      type: "PITCH_APPROVED",
      relatedId: pitchId,
      url: `/trainee/pitch/${pitchId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (e) {
    console.error(`Pitch approval notification failed for pitch ${pitchId}:`, e);
  }
}

export async function notifyFounderOfRejection(pitchId: string, traineeId: string, startupName: string, reason: string) {
  try {
    const founder = await founderContact(traineeId);
    if (!founder) return;
    const content = pitchRejectedEmail(startupName, reason, appUrl(`/trainee/pitch/${pitchId}`));
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: founder.email,
      type: "PITCH_REJECTED",
      relatedId: pitchId,
      url: `/trainee/pitch/${pitchId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (e) {
    console.error(`Pitch rejection notification failed for pitch ${pitchId}:`, e);
  }
}

export async function notifyFounderOfPublish(pitchId: string, traineeId: string, startupName: string) {
  try {
    const founder = await founderContact(traineeId);
    if (!founder) return;
    const content = pitchPublishedEmail(startupName, appUrl(`/trainee/pitch/${pitchId}`));
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: founder.email,
      type: "PITCH_PUBLISHED",
      relatedId: pitchId,
      url: `/trainee/pitch/${pitchId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (e) {
    console.error(`Pitch published notification failed for pitch ${pitchId}:`, e);
  }
}

export async function notifyFounderOfDisclosureRequest(pitchId: string, traineeId: string, startupName: string, investorOrg: string) {
  try {
    const founder = await founderContact(traineeId);
    if (!founder) return;
    const content = pitchDisclosureRequestedEmail(startupName, investorOrg, appUrl(`/trainee/pitch/${pitchId}`));
    await notifyByEmail({
      recipientType: "TRAINEE",
      recipientId: traineeId,
      to: founder.email,
      type: "PITCH_DISCLOSURE_REQUESTED",
      relatedId: pitchId,
      url: `/trainee/pitch/${pitchId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (e) {
    console.error(`Pitch disclosure request notification failed for pitch ${pitchId}:`, e);
  }
}

export async function notifyInvestorOfDisclosureResponse(investorId: string, pitchId: string, startupName: string, accepted: boolean) {
  try {
    const investor = await prisma.investor.findUnique({ where: { id: investorId }, select: { email: true } });
    if (!investor) return;
    const content = pitchDisclosureResponseEmail(startupName, accepted, appUrl(`/investor/pitches/${pitchId}`));
    await notifyByEmail({
      recipientType: "INVESTOR",
      recipientId: investorId,
      to: investor.email,
      type: "PITCH_DISCLOSURE_RESPONSE",
      relatedId: pitchId,
      url: `/investor/pitches/${pitchId}`,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  } catch (e) {
    console.error(`Pitch disclosure response notification failed for pitch ${pitchId}:`, e);
  }
}

export async function notifyOfInterest(pitchId: string, traineeId: string, startupName: string, investorOrg: string) {
  try {
    const founder = await founderContact(traineeId);
    const content = pitchInterestReceivedEmail(startupName, investorOrg, appUrl(`/trainee/pitch/${pitchId}`));
    if (founder) {
      await notifyByEmail({
        recipientType: "TRAINEE",
        recipientId: traineeId,
        to: founder.email,
        type: "PITCH_INTEREST_RECEIVED",
        relatedId: pitchId,
        url: `/trainee/pitch/${pitchId}`,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    }
    const admins = await prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      select: { id: true, email: true },
    });
    const adminContent = pitchInterestReceivedEmail(startupName, investorOrg, appUrl(`/admin/pitches/${pitchId}`));
    for (const admin of admins) {
      await notifyByEmail({
        recipientType: "STAFF",
        recipientId: admin.id,
        to: admin.email,
        type: "PITCH_INTEREST_RECEIVED",
        relatedId: pitchId,
        url: `/admin/pitches/${pitchId}`,
        subject: adminContent.subject,
        html: adminContent.html,
        text: adminContent.text,
      });
    }
  } catch (e) {
    console.error(`Pitch interest notification failed for pitch ${pitchId}:`, e);
  }
}

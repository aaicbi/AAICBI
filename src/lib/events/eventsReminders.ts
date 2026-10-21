import { prisma } from "@/lib/prisma";
import { DAY_MS, dueReminder } from "@/lib/events/eventsCore";
import { audienceRecipients, sendNotice, recipientOfProfile, type Recipient } from "@/lib/events/eventsNotify";
import { noticeFor } from "@/lib/events/eventsNotices";
import { getEventSettings } from "@/lib/events/eventsAccess";
import { sweepScheduledPublications } from "@/lib/events/events";

/**
 * The hourly job: publishes approved events whose publication time has come, and sends each reminder once. A public event reminds only the
 * people who registered (not the whole platform); an event for chosen people reminds them all. Safe to run twice: nobody is told twice.
 */
export async function runEventSweep(now: Date = new Date()): Promise<{ published: number; reminded: number }> {
  const settings = await getEventSettings();
  if (!settings.enabled) return { published: 0, reminded: 0 };
  const published = await sweepScheduledPublications(now);
  const soon = await prisma.event.findMany({
    where: { status: "SCHEDULED", startsAt: { gt: now, lte: new Date(now.getTime() + DAY_MS + 60 * 60_000) } },
    select: { id: true, title: true, startsAt: true, endsAt: true, timeZone: true, audience: true, trainingOrganizationId: true, trainingOrganization: { select: { name: true } }, targets: { select: { kind: true, refId: true } } },
    take: 500,
  });
  let reminded = 0;
  for (const e of soon) {
    const kinds = await prisma.eventNotice.findMany({ where: { eventId: e.id, kind: { in: ["REMINDER_DAY", "REMINDER_HOUR"] } }, select: { kind: true }, distinct: ["kind"] });
    const due = dueReminder(e.startsAt, now, new Set(kinds.map((k) => k.kind)));
    if (!due) continue;
    const ne = { id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, timeZone: e.timeZone, organizer: e.trainingOrganization?.name ?? "AAICBI" };
    const regs = await prisma.eventRegistration.findMany({ where: { eventId: e.id, status: "CONFIRMED" }, select: { profileId: true } });
    const registered: Recipient[] = [];
    for (const r of regs) { const x = await recipientOfProfile(r.profileId); if (x) registered.push(x); }
    const audience = e.audience === "PUBLIC" ? [] : await audienceRecipients({ trainingOrganizationId: e.trainingOrganizationId, audience: e.audience, targets: e.targets.map((t) => ({ kind: t.kind as never, refId: t.refId })) });
    reminded += await sendNotice(e.id, due.kind, [...registered, ...audience], noticeFor(due.kind, ne));
    // Mark the reminder as sent even when nobody was due it (an event with no one registered), so the job does not look again.
    await prisma.eventNotice.createMany({ data: [{ eventId: e.id, kind: due.kind, recipientType: "SYSTEM", recipientId: "sweep" }], skipDuplicates: true });
  }
  return { published, reminded };
}

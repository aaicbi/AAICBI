import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { getEcosystemFlags } from "@/lib/ecosystem/flags";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";
import { playbookEntries } from "@/lib/guide/playbooks";
import type { MeKind } from "@/lib/guide/context";
import { sanitizeLinks } from "@/lib/guide/links";
import { scrubQuestion } from "@/lib/guide/scrub";
import type { GuideEntry, GuideSwitches } from "@/lib/guide/types";

/** The most written answers a SUPER_ADMIN can add, so the answer bank stays small enough to send to the browser. */
export const MAX_CUSTOM_ENTRIES = 200;
const MAX_OPEN_UNANSWERED = 2000;

export interface GuideConfig {
  enabled: boolean;
  switches: GuideSwitches;
  entries: GuideEntry[];
  skills: string[];
}

export function toEntry(row: { id: string; question: string; answer: string; links: unknown; keywords: string[] }): GuideEntry {
  return { id: `custom:${row.id}`, question: row.question, answer: row.answer, links: sanitizeLinks(row.links), keywords: row.keywords, source: "custom" };
}

/** Everything the browser needs to answer questions: the switch, the written answers, and the skills the platform has. */
export async function loadGuideConfig(): Promise<GuideConfig> {
  const [flags, settings] = await Promise.all([
    getEcosystemFlags(),
    prisma.platformSettings.findUnique({ where: { id: "singleton" }, select: { guideEnabled: true } }).catch(() => null),
  ]);
  const switches: GuideSwitches = { orgPages: flags.orgPages, education: flags.education, feed: flags.feed, publicJobs: flags.publicJobs, publicTrainees: flags.publicTrainees };
  const enabled = settings ? settings.guideEnabled : true;
  if (!enabled) return { enabled: false, switches, entries: [], skills: [] };

  const [custom, skills] = await Promise.all([
    prisma.guideEntry.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" }, take: MAX_CUSTOM_ENTRIES, select: { id: true, question: true, answer: true, links: true, keywords: true } }).catch(() => []),
    prisma.skill
      .findMany({
        where: { OR: [{ courseSkills: { some: {} } }, { jobPostingSkills: { some: {} } }, { educationPostSkills: { some: {} } }, { traineeSkills: { some: {} } }] },
        select: { name: true },
        orderBy: { name: "asc" },
        take: 300,
      })
      .catch(() => []),
  ]);
  return { enabled, switches, entries: [...DEFAULT_ENTRIES, ...playbookEntries(), ...custom.map(toEntry)], skills: skills.map((s) => s.name) };
}

/** Who is looking, for the shortcuts Loop offers first. Reads the session; never returns anything about the person. */
export async function whoAmI(): Promise<MeKind | null> {
  const session = await getSession().catch(() => null);
  if (!session) return null;
  switch (session.role) {
    case "TRAINEE": return "trainee";
    case "EMPLOYER": return "employer";
    case "INVESTOR": return "investor";
    default: {
      const org = await findTrainingOrgByStaffUserId(session.userId).catch(() => null);
      return org ? "organization" : "staff";
    }
  }
}

/**
 * Remembers a question Loop could not answer, grouped with identical ones so
 * the team sees a count. Returns false when the question is not worth
 * keeping or the queue is full. Stores only scrubbed text: no account, no
 * address, nothing else about who asked.
 */
export async function recordUnanswered(question: string): Promise<boolean> {
  const text = scrubQuestion(question);
  if (!text) return false;
  const existing = await prisma.guideUnanswered.findUnique({ where: { text }, select: { id: true } });
  if (!existing) {
    const open = await prisma.guideUnanswered.count({ where: { status: "OPEN" } });
    if (open >= MAX_OPEN_UNANSWERED) return false;
  }
  await prisma.guideUnanswered.upsert({
    where: { text },
    create: { text },
    update: { asked: { increment: 1 }, lastAskedAt: new Date() },
  });
  return true;
}

import { PLAYBOOKS } from "@/lib/guide/playbooks/data";
import type { GuideEntry } from "@/lib/guide/types";
import type { Playbook } from "@/lib/guide/playbooks/types";

export { PLAYBOOKS };
export type { Playbook, PlaybookStep } from "@/lib/guide/playbooks/types";

export function getPlaybook(id: string): Playbook | undefined {
  return PLAYBOOKS.find((p) => p.id === id);
}

/** The questions that start each guide, so the ordinary matcher finds them. */
export function playbookEntries(): GuideEntry[] {
  return PLAYBOOKS.map((p) => ({
    id: `playbook:${p.id}`,
    question: p.question,
    answer: p.summary,
    links: [],
    keywords: p.keywords,
    source: "default",
    playbookId: p.id,
    audience: p.audience,
  }));
}

/** The guides written for one kind of account, shown first to that account. */
export function playbooksFor(audience: "organization" | "trainee"): Playbook[] {
  return PLAYBOOKS.filter((p) => p.audience === audience);
}

/**
 * Entries a given account should be matched against. A step-by-step guide
 * written for organizations is not offered to trainees or visitors, and
 * trainee guides are not offered to organizations, so similar questions
 * ("How do I take a module assessment?" vs "How do I set one?") reach the
 * right guide.
 */
export function entriesForAudience(entries: GuideEntry[], me: string | null): GuideEntry[] {
  return entries.filter((e) => {
    if (!e.audience) return true;
    if (e.audience === "organization") return me === "organization";
    return me !== "organization";
  });
}

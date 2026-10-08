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
  }));
}

/** Pure matching rules for "video -> program" recommendations — unit-tested, no database. */

const norm = (s: string) => s.trim().toLowerCase();

export function overlapCount(a: string[], b: string[]): number {
  const set = new Set(a.map(norm));
  let n = 0;
  for (const x of new Set(b.map(norm))) if (set.has(x)) n++;
  return n;
}

export interface ProgramCandidate {
  id: string;
  title: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  category: string | null;
  durationDisplay: string | null;
  skills: string[];
}

export interface VideoContext {
  skills: string[];
  category: string | null;
  /** The program the organization explicitly tagged the video with, if any. */
  courseId: string | null;
  organizationId: string;
}

/**
 * Relevance of a program to a video. Shared skills count most; a matching
 * category helps; an explicit tag by the publishing organization is a
 * strong signal. The publishing organization gets only a small nudge, and
 * nothing about an organization's size, activity or payment is considered,
 * so recommendations cannot be bought or farmed. Zero means "not relevant".
 */
export function scoreProgram(video: VideoContext, program: ProgramCandidate): number {
  const shared = overlapCount(video.skills, program.skills);
  const sameCategory = !!video.category && !!program.category && norm(video.category) === norm(program.category);
  const tagged = video.courseId === program.id;
  if (shared === 0 && !sameCategory && !tagged) return 0;
  return shared * 2 + (sameCategory ? 1 : 0) + (tagged ? 5 : 0) + (program.organizationId === video.organizationId ? 0.5 : 0);
}

/** Best programs first, at most `perOrg` from one organization, relevant ones only. */
export function rankPrograms(video: VideoContext, candidates: ProgramCandidate[], limit: number, perOrg = 1): ProgramCandidate[] {
  const scored = candidates
    .map((p) => ({ p, score: scoreProgram(video, p) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.title.localeCompare(b.p.title));
  const counts = new Map<string, number>();
  const out: ProgramCandidate[] = [];
  for (const { p } of scored) {
    const n = counts.get(p.organizationId) ?? 0;
    if (n >= perOrg) continue;
    counts.set(p.organizationId, n + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Keeps free-text skills tidy: trimmed, de-duplicated case-insensitively, capped. */
export function cleanSkillList(raw: string[], max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const t = r.trim().replace(/\s+/g, " ").slice(0, 40);
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

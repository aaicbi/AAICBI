import { filterLinks } from "@/lib/guide/links";
import { rawWords, STOP, stripAccents, tokens } from "@/lib/guide/text";
import type { GuideEntry, GuideLink, GuideReply, GuideSwitches } from "@/lib/guide/types";

/**
 * How Loop finds an answer, with no AI service involved.
 *
 * Every written question is reduced to its meaningful words (see text.ts).
 * A visitor's question gets a score against each one: how much of what
 * they asked is covered (weighting rarer words more) and how much of the
 * written question they touched. A good score returns that answer; a weak
 * score returns "did you mean" suggestions; nothing returns a fallback
 * that lists good places to start. If the question names a skill the
 * platform really has (Python, Data Analytics), the answer also offers
 * links that search for that skill. Everything is deterministic and runs
 * in the browser, so answers are instant and free.
 */

export const ANSWER_MIN = 0.5;
export const RELATED_MIN = 0.28;
/** An answer a SUPER_ADMIN wrote wins a near tie against a built-in one. */
export const CUSTOM_BOOST = 0.04;
const LEX_WEIGHT = 0.1;

interface Indexed {
  entry: GuideEntry;
  qSet: Set<string>;
  allSet: Set<string>;
  words: string[];
}

interface SkillEntry {
  name: string;
  words: string[];
}

export interface GuideIndex {
  items: Indexed[];
  idf: Map<string, number>;
  unknownWeight: number;
  skills: SkillEntry[];
}

const stemLoose = (w: string) => w.replace(/(?:ies|es|s)$/, "");

export function buildIndex(entries: GuideEntry[], skillNames: string[] = []): GuideIndex {
  const items: Indexed[] = entries.map((entry) => {
    const qSet = new Set(tokens(entry.question));
    const allSet = new Set([...qSet, ...entry.keywords.flatMap((k) => tokens(k))]);
    const words = [...rawWords(entry.question), ...entry.keywords.flatMap((k) => rawWords(k))];
    return { entry, qSet, allSet, words };
  });
  const df = new Map<string, number>();
  for (const it of items) for (const t of it.allSet) df.set(t, (df.get(t) ?? 0) + 1);
  const n = Math.max(1, items.length);
  const idf = new Map<string, number>();
  for (const [t, c] of df) idf.set(t, Math.log(1 + n / c));
  const skills = [...new Set(skillNames.map((s) => s.trim()).filter((s) => s.length >= 2))]
    .map((name) => ({ name, words: rawWords(name).map(stemLoose) }))
    .filter((s) => s.words.length > 0)
    .sort((a, b) => b.words.length - a.words.length || b.name.length - a.name.length);
  // A word nobody wrote about is most likely a topic ("developer", "refund"): it counts, but less.
  return { items, idf, unknownWeight: Math.log(1 + n) * 0.5, skills };
}

function weight(index: GuideIndex, t: string): number {
  return index.idf.get(t) ?? index.unknownWeight;
}

/**
 * The share of the visitor's own words (not concept words) that appear in the
 * written question or its keywords. It only breaks ties between answers
 * that mean nearly the same ("verify" a certificate vs "get" one).
 */
function lexical(words: string[], it: Indexed): number {
  if (words.length === 0) return 0;
  const have = new Set(it.words.map(stemLoose));
  return words.filter((w) => have.has(w)).length / words.length;
}

function score(index: GuideIndex, q: { set: Set<string>; words: string[] }, it: Indexed): number {
  if (q.set.size === 0) return 0;
  let qTotal = 0, qHit = 0, eTotal = 0, eHit = 0;
  for (const t of q.set) {
    const w = weight(index, t);
    qTotal += w;
    if (it.allSet.has(t)) qHit += w;
  }
  for (const t of it.qSet) {
    const w = weight(index, t);
    eTotal += w;
    if (q.set.has(t)) eHit += w;
  }
  const cov = qTotal ? qHit / qTotal : 0;
  const ecov = eTotal ? eHit / eTotal : 0;
  return 0.7 * cov + 0.3 * ecov + LEX_WEIGHT * lexical(q.words, it) + (it.entry.source === "custom" ? CUSTOM_BOOST : 0);
}

interface Scored {
  it: Indexed;
  score: number;
}

export function rank(question: string, index: GuideIndex): Scored[] {
  const q = { set: new Set(tokens(question)), words: rawWords(question).filter((w) => !STOP.has(w)).map(stemLoose) };
  return index.items
    .map((it) => ({ it, score: score(index, q, it) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.it.entry.question.length - b.it.entry.question.length);
}

/**
 * Typeahead: written questions that contain what has been typed so far.
 * Every typed word must begin some word of the question or its keywords.
 */
export function suggest(partial: string, index: GuideIndex, limit = 4): string[] {
  const typed = rawWords(partial).filter((w) => w.length >= 2 && !STOP.has(w));
  if (typed.length === 0) return [];
  const scored: Array<{ q: string; hits: number; len: number }> = [];
  for (const it of index.items) {
    const words = it.words.map((w) => stripAccents(w));
    let hits = 0;
    let all = true;
    for (const w of typed) {
      if (words.some((x) => x.startsWith(w))) hits++;
      else all = false;
    }
    if (all) scored.push({ q: it.entry.question, hits, len: it.entry.question.length });
  }
  return scored.sort((a, b) => b.hits - a.hits || a.len - b.len).slice(0, limit).map((s) => s.q);
}

/** The platform skill a question names, if any, preferring the longest name. */
export function detectSkill(question: string, index: GuideIndex): string | null {
  const words = rawWords(question).map(stemLoose);
  for (const s of index.skills) {
    for (let i = 0; i + s.words.length <= words.length; i++) {
      if (s.words.every((w, j) => words[i + j] === w)) return s.name;
    }
  }
  return null;
}

const INTENT_ONLY = new Set(["job", "training", "trainee", "organization", "event", "video", "employer", "skill"]);

/** True when, apart from the skill's own words, the question only says what kind of thing to look for. */
function isSkillOnlyQuestion(question: string, skill: string): boolean {
  const skillTokens = new Set(tokens(skill));
  const rest = tokens(question).filter((t) => !skillTokens.has(t));
  return rest.every((t) => INTENT_ONLY.has(t));
}

function topicLinks(skill: string, question: string, on: GuideSwitches): GuideLink[] {
  const t = new Set(tokens(question));
  const enc = encodeURIComponent(skill);
  const programs: GuideLink = on.orgPages
    ? { label: `Explore ${skill} programs and organizations`, href: `/search?q=${enc}` }
    : { label: "Browse training programs", href: "/courses" };
  const jobs: GuideLink = { label: `See ${skill} opportunities`, href: `/jobs?q=${enc}` };
  const people: GuideLink = { label: `Meet ${skill} trainees`, href: `/trainees?q=${enc}` };
  let order = [programs, jobs, people];
  if (t.has("job") || t.has("employer")) order = [jobs, programs, people];
  else if (t.has("trainee")) order = [people, programs, jobs];
  return filterLinks(order, on);
}

function dedupe(links: GuideLink[], max = 5): GuideLink[] {
  const seen = new Set<string>();
  const out: GuideLink[] = [];
  for (const l of links) {
    if (seen.has(l.href)) continue;
    seen.add(l.href);
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}

const START_HERE: GuideLink[] = [
  { label: "Browse training programs", href: "/courses" },
  { label: "See opportunities", href: "/jobs" },
  { label: "Meet training organizations", href: "/organizations" },
  { label: "Explore trainees", href: "/trainees" },
  { label: "Join the ecosystem", href: "/#join" },
];

export function startHere(on: GuideSwitches): GuideLink[] {
  return filterLinks(START_HERE, on);
}

export function answerQuestion(question: string, index: GuideIndex, on: GuideSwitches): GuideReply {
  const ranked = rank(question, index);
  const best = ranked[0];
  const skill = detectSkill(question, index);
  const related = (skipFirst: boolean) =>
    ranked
      .slice(skipFirst ? 1 : 0)
      .filter((s) => s.score >= RELATED_MIN)
      .slice(0, 3)
      .map((s) => s.it.entry.question);

  // "python jobs", "I want to learn SQL": a skill and nothing but what to look for. Go straight to it.
  if (skill && isSkillOnlyQuestion(question, skill)) {
    return { kind: "topic", text: `Here is where you can explore ${skill}:`, links: dedupe(topicLinks(skill, question, on)), related: [] };
  }

  if (best && best.score >= ANSWER_MIN) {
    const e = best.it.entry;
    const links = filterLinks(e.links, on);
    if (skill && best.score < 0.85) {
      return { kind: "answer", text: e.answer, links: dedupe([...topicLinks(skill, question, on).slice(0, 2), ...links]), matchedQuestion: e.question, related: related(true) };
    }
    return { kind: "answer", text: e.answer, links: dedupe(links), matchedQuestion: e.question, related: related(true) };
  }
  if (skill) {
    return { kind: "topic", text: `Here is where you can explore ${skill}:`, links: dedupe(topicLinks(skill, question, on)), related: related(false) };
  }
  return {
    kind: "fallback",
    text: "I don't have a written answer for that yet. I've noted your question for the team. These are good places to start:",
    links: startHere(on),
    related: related(false),
  };
}

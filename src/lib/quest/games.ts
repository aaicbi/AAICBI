/**
 * Game Studio: the pure rules for the non-quiz formats (no database).
 *
 * Each format has a content shape, a validator (what an item must look like to be
 * saved), a "serve" step that turns stored content into what a trainee's browser
 * may see (never the answer key), and a grader that runs on the server only.
 * Quiz practice plays from the question bank and is not described here.
 */
import { shuffle as defaultShuffle } from "@/lib/shuffle";

export type GameFormat = "QUIZ" | "MATCHING" | "ORDERING" | "SCENARIO";
export type ItemFormat = Exclude<GameFormat, "QUIZ">;

export const FORMAT_INFO: Record<GameFormat, { label: string; blurb: string; itemNoun: string }> = {
  QUIZ: { label: "Quiz practice", blurb: "Questions by objective with hints, XP and mastery, built from the approved question bank.", itemNoun: "question" },
  MATCHING: { label: "Matching cards", blurb: "Match each term to its meaning.", itemNoun: "matching set" },
  ORDERING: { label: "Put in order", blurb: "Arrange the steps of a process in the right order.", itemNoun: "sequence" },
  SCENARIO: { label: "Scenario choices", blurb: "A short case where the trainee picks an action and sees the outcome.", itemNoun: "scenario" },
};

export const ITEM_FORMATS: ItemFormat[] = ["MATCHING", "ORDERING", "SCENARIO"];
export const isItemFormat = (f: string): f is ItemFormat => (ITEM_FORMATS as string[]).includes(f);

export interface MatchingContent { prompt: string; pairs: { left: string; right: string }[] }
export interface OrderingContent { prompt: string; steps: string[] }
export interface ScenarioContent { situation: string; options: { text: string; outcome: string; correct: boolean }[] }
export type ItemContent = MatchingContent | OrderingContent | ScenarioContent;

const LIMITS = { text: 300, long: 800, pairs: [3, 6], steps: [3, 8], options: [2, 4] } as const;

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const unique = (list: string[]) => new Set(list.map((s) => s.toLowerCase())).size === list.length;

export type Validated = { ok: true; content: ItemContent } | { ok: false; error: string };

export function validateItemContent(format: ItemFormat, raw: unknown): Validated {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (format === "MATCHING") {
    const prompt = clean(r.prompt, LIMITS.long) || "Match each term to its meaning.";
    const pairs = Array.isArray(r.pairs)
      ? r.pairs.map((p) => ({ left: clean((p as { left?: unknown })?.left, LIMITS.text), right: clean((p as { right?: unknown })?.right, LIMITS.text) }))
      : [];
    if (pairs.length < LIMITS.pairs[0] || pairs.length > LIMITS.pairs[1]) return { ok: false, error: `A matching set needs ${LIMITS.pairs[0]} to ${LIMITS.pairs[1]} pairs.` };
    if (pairs.some((p) => !p.left || !p.right)) return { ok: false, error: "Every pair needs both a term and a meaning." };
    if (!unique(pairs.map((p) => p.left)) || !unique(pairs.map((p) => p.right))) return { ok: false, error: "Terms must all be different, and so must meanings." };
    return { ok: true, content: { prompt, pairs } };
  }
  if (format === "ORDERING") {
    const prompt = clean(r.prompt, LIMITS.long);
    const steps = Array.isArray(r.steps) ? r.steps.map((s) => clean(s, LIMITS.text)) : [];
    if (!prompt) return { ok: false, error: "Say what the steps are for, for example “Put the steps of this workflow in order”." };
    if (steps.length < LIMITS.steps[0] || steps.length > LIMITS.steps[1]) return { ok: false, error: `A sequence needs ${LIMITS.steps[0]} to ${LIMITS.steps[1]} steps.` };
    if (steps.some((s) => !s)) return { ok: false, error: "Every step needs some text." };
    if (!unique(steps)) return { ok: false, error: "Steps must all be different." };
    return { ok: true, content: { prompt, steps } };
  }
  const situation = clean(r.situation, LIMITS.long);
  const options = Array.isArray(r.options)
    ? r.options.map((o) => ({
        text: clean((o as { text?: unknown })?.text, LIMITS.text),
        outcome: clean((o as { outcome?: unknown })?.outcome, LIMITS.long),
        correct: (o as { correct?: unknown })?.correct === true,
      }))
    : [];
  if (!situation) return { ok: false, error: "Describe the situation." };
  if (options.length < LIMITS.options[0] || options.length > LIMITS.options[1]) return { ok: false, error: `A scenario needs ${LIMITS.options[0]} to ${LIMITS.options[1]} options.` };
  if (options.some((o) => !o.text || !o.outcome)) return { ok: false, error: "Every option needs its text and what happens if it is chosen." };
  if (options.filter((o) => o.correct).length !== 1) return { ok: false, error: "Exactly one option must be the best choice." };
  if (!unique(options.map((o) => o.text))) return { ok: false, error: "Options must all be different." };
  return { ok: true, content: { situation, options } };
}

/** All visible words of an item, for the minimum answer time. */
export function itemText(format: ItemFormat, content: ItemContent): string {
  if (format === "MATCHING") {
    const c = content as MatchingContent;
    return [c.prompt, ...c.pairs.flatMap((p) => [p.left, p.right])].join(" ");
  }
  if (format === "ORDERING") {
    const c = content as OrderingContent;
    return [c.prompt, ...c.steps].join(" ");
  }
  const c = content as ScenarioContent;
  return [c.situation, ...c.options.map((o) => o.text)].join(" ");
}

export type Served =
  | { format: "MATCHING"; prompt: string; lefts: string[]; rights: string[] }
  | { format: "ORDERING"; prompt: string; steps: string[] }
  | { format: "SCENARIO"; situation: string; options: string[] };

/** What a trainee's browser may see: the items, shuffled, with no answer key. */
export function serveItem(format: ItemFormat, content: ItemContent, shuffle: <T>(a: readonly T[]) => T[] = defaultShuffle): Served {
  if (format === "MATCHING") {
    const c = content as MatchingContent;
    return { format, prompt: c.prompt, lefts: c.pairs.map((p) => p.left), rights: shuffle(c.pairs.map((p) => p.right)) };
  }
  if (format === "ORDERING") {
    const c = content as OrderingContent;
    // Never serve the steps already in order.
    let steps = shuffle(c.steps);
    for (let i = 0; i < 5 && steps.every((s, k) => s === c.steps[k]); i++) steps = shuffle(c.steps);
    return { format, prompt: c.prompt, steps };
  }
  const c = content as ScenarioContent;
  return { format, situation: c.situation, options: shuffle(c.options.map((o) => o.text)) };
}

export type Response =
  | { matches: Record<string, string> }
  | { order: string[] }
  | { choice: string };

export interface Graded {
  /** 0 to 1, the share answered correctly. */
  score: number;
  /** Full marks. */
  correct: boolean;
  /** What to show after answering (this is where the key may be revealed). */
  feedback: Record<string, unknown>;
}

export function gradeItem(format: ItemFormat, content: ItemContent, response: unknown): Graded | null {
  const r = (response ?? {}) as Record<string, unknown>;
  if (format === "MATCHING") {
    const c = content as MatchingContent;
    const matches = (r.matches ?? {}) as Record<string, unknown>;
    if (typeof matches !== "object" || matches === null) return null;
    const results = c.pairs.map((p, i) => ({ left: p.left, right: p.right, chosen: typeof matches[String(i)] === "string" ? (matches[String(i)] as string) : null }));
    if (results.some((x) => x.chosen === null)) return null; // everything must be matched
    const good = results.filter((x) => x.chosen === x.right).length;
    return { score: good / c.pairs.length, correct: good === c.pairs.length, feedback: { pairs: results.map((x) => ({ left: x.left, right: x.right, chosen: x.chosen, ok: x.chosen === x.right })) } };
  }
  if (format === "ORDERING") {
    const c = content as OrderingContent;
    const order = r.order;
    if (!Array.isArray(order) || order.length !== c.steps.length || !order.every((s) => typeof s === "string")) return null;
    if (new Set(order).size !== order.length || !order.every((s) => c.steps.includes(s as string))) return null;
    const good = c.steps.filter((s, i) => order[i] === s).length;
    return { score: good / c.steps.length, correct: good === c.steps.length, feedback: { correctOrder: c.steps, chosen: order, positions: c.steps.map((s, i) => order[i] === s) } };
  }
  const c = content as ScenarioContent;
  const choice = r.choice;
  if (typeof choice !== "string") return null;
  const picked = c.options.find((o) => o.text === choice);
  if (!picked) return null;
  const best = c.options.find((o) => o.correct)!;
  return { score: picked.correct ? 1 : 0, correct: picked.correct, feedback: { chosen: picked.text, outcome: picked.outcome, best: best.text, bestOutcome: best.outcome } };
}

/** Short label for a list of items in the studio. */
export function itemTitle(format: ItemFormat, content: ItemContent): string {
  const text =
    format === "MATCHING" ? (content as MatchingContent).pairs.map((p) => p.left).join(", ")
    : format === "ORDERING" ? (content as OrderingContent).prompt
    : (content as ScenarioContent).situation;
  return text.length > 90 ? `${text.slice(0, 87)}…` : text;
}

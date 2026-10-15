/**
 * Importing reviewed content files (the module-content skill's output) into a module: the pure part.
 *
 * A file holds, per learning objective, quiz questions, matching sets, ordering sequences and scenarios that were written from the
 * lesson materials and reviewed outside the platform. Nothing here touches the database: it checks the file against the platform's
 * own rules, lines the file's objectives up with the module's, and works out what would be created and what would be skipped
 * (anything the module already has), so a person can look before anything is saved.
 */
import { validateItemContent, type ItemContent, type ItemFormat } from "@/lib/quest/games";

export interface FileQuiz {
  question: string;
  options: string[];
  correct: number;
  explanation?: string | null;
}
export interface FileObjective {
  number: number;
  text: string;
  quiz: FileQuiz[];
  matching: unknown[];
  ordering: unknown[];
  scenario: unknown[];
}
export interface ContentFile {
  course: string;
  module: string;
  objectives: FileObjective[];
}

export type FileFormat = "quiz" | ItemFormat | "matching" | "ordering" | "scenario";
export const FILE_FORMATS = ["quiz", "matching", "ordering", "scenario"] as const;
export type FileKind = (typeof FILE_FORMATS)[number];
export const GAME_FORMAT_OF: Record<Exclude<FileKind, "quiz">, ItemFormat> = { matching: "MATCHING", ordering: "ORDERING", scenario: "SCENARIO" };

export const MAX_OBJECTIVES = 20;
export const MAX_ITEMS_PER_FORMAT = 40;

export function parseContentFile(raw: unknown): { ok: true; file: ContentFile } | { ok: false; error: string } {
  const r = raw as Partial<ContentFile> | null;
  if (!r || typeof r !== "object" || !Array.isArray(r.objectives) || r.objectives.length === 0) return { ok: false, error: "That doesn't look like a content file: it has no objectives." };
  if (r.objectives.length > MAX_OBJECTIVES) return { ok: false, error: `A content file can hold at most ${MAX_OBJECTIVES} objectives.` };
  for (const o of r.objectives) {
    if (!o || typeof o.text !== "string" || !o.text.trim()) return { ok: false, error: "Every objective in the file needs its text." };
    for (const k of FILE_FORMATS) {
      const list = (o as unknown as Record<string, unknown>)[k];
      if (!Array.isArray(list)) return { ok: false, error: `Objective “${o.text.slice(0, 40)}” is missing its ${k} list.` };
      if (list.length > MAX_ITEMS_PER_FORMAT) return { ok: false, error: `Objective “${o.text.slice(0, 40)}” has more than ${MAX_ITEMS_PER_FORMAT} ${k} items.` };
    }
  }
  return { ok: true, file: { course: String(r.course ?? ""), module: String(r.module ?? ""), objectives: r.objectives as FileObjective[] } };
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (t: string) => new Set(norm(t).split(" ").filter((w) => w.length > 2));

/** How alike two objective texts are, 0 to 1: the share of the shorter text's words found in the other (so a short objective and a longer wording of it still match). */
export function textSimilarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  const small = Math.min(A.size, B.size);
  if (small < 3) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / small;
}

export interface ExistingObjective {
  id: string;
  text: string;
  order: number;
}
export interface ObjectiveMatch {
  fileIndex: number;
  /** The module's objective it lines up with, or null when a new one would be created from the file. */
  existing: ExistingObjective | null;
  how: "same text" | "similar text" | "new" | "chosen" | "skipped";
}

/** A person's choice for one file objective: an existing objective's id, "new" (add it), or "skip" (leave its content out). */
export type ObjectiveChoices = Record<number, string>;

/** Lines the file's objectives up with the module's: same text first, then clearly similar text, otherwise new. Each existing one is used once. */
export function matchObjectives(file: ContentFile, existing: ExistingObjective[], threshold = 0.7, choices: ObjectiveChoices = {}): ObjectiveMatch[] {
  const used = new Set<string>();
  const result: ObjectiveMatch[] = file.objectives.map((_, fileIndex): ObjectiveMatch => ({ fileIndex, existing: null, how: "new" }));
  const decided = new Set<number>();
  // What a person chose always wins over the automatic lining up.
  for (const [k, choice] of Object.entries(choices)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= file.objectives.length) continue;
    decided.add(i);
    if (choice === "skip") result[i] = { fileIndex: i, existing: null, how: "skipped" };
    else if (choice === "new") result[i] = { fileIndex: i, existing: null, how: "new" };
    else {
      const e = existing.find((x) => x.id === choice);
      if (e && !used.has(e.id)) {
        used.add(e.id);
        result[i] = { fileIndex: i, existing: e, how: "chosen" };
      } else decided.delete(i);
    }
  }
  file.objectives.forEach((o, i) => {
    if (decided.has(i)) return;
    const hit = existing.find((e) => !used.has(e.id) && norm(e.text) === norm(o.text));
    if (hit) {
      used.add(hit.id);
      result[i] = { fileIndex: i, existing: hit, how: "same text" };
    }
  });
  file.objectives.forEach((o, i) => {
    if (decided.has(i) || result[i].existing) return;
    let best: { e: ExistingObjective; s: number } | null = null;
    for (const e of existing) {
      if (used.has(e.id)) continue;
      const s = textSimilarity(o.text, e.text);
      if (s >= threshold && (!best || s > best.s)) best = { e, s };
    }
    if (best) {
      used.add(best.e.id);
      result[i] = { fileIndex: i, existing: best.e, how: "similar text" };
    }
  });
  return result;
}

/** A stable fingerprint of an item so the same content is never imported twice. */
export function itemSignature(kind: FileKind, item: unknown): string {
  const x = item as Record<string, unknown>;
  if (kind === "quiz") return `q|${norm(String(x.question ?? ""))}`;
  if (kind === "matching") return `m|${norm(String(x.prompt ?? ""))}|${((x.pairs as { left: string }[]) ?? []).map((p) => norm(p.left)).sort().join(",")}`;
  if (kind === "ordering") return `o|${((x.steps as string[]) ?? []).map(norm).join(">")}`;
  return `s|${norm(String(x.situation ?? ""))}`;
}

export type QuizPool = "PRACTICE" | "FORMAL";

export interface CleanQuiz {
  /** Which side of the question bank it goes to: games and practice, or the assessment. */
  pool?: QuizPool;
  question: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string | null;
}

export function cleanQuiz(q: FileQuiz): { ok: true; quiz: CleanQuiz } | { ok: false; error: string } {
  const question = (q.question ?? "").replace(/\s+/g, " ").trim();
  const options = Array.isArray(q.options) ? q.options.map((o) => String(o).replace(/\s+/g, " ").trim()) : [];
  if (question.length < 5 || question.length > 1000) return { ok: false, error: "The question text is missing or too long." };
  if (options.length < 2 || options.length > 6 || options.some((o) => !o || o.length > 500)) return { ok: false, error: "A question needs two to six options of reasonable length." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { ok: false, error: "Two options are the same." };
  if (!Number.isInteger(q.correct) || q.correct < 0 || q.correct >= options.length) return { ok: false, error: "The right answer isn't one of the options." };
  return { ok: true, quiz: { question, options: options.map((text, i) => ({ text, isCorrect: i === q.correct })), explanation: q.explanation ? String(q.explanation).slice(0, 1000) : null } };
}

export interface PlannedObjective {
  fileIndex: number;
  number: number;
  text: string;
  match: ObjectiveMatch;
  counts: Record<FileKind, { create: number; duplicate: number; invalid: number }>;
  invalid: { kind: FileKind; index: number; error: string }[];
  quiz: CleanQuiz[];
  items: { format: ItemFormat; content: ItemContent }[];
  /** How many of the new quiz questions are set aside for the assessment. */
  reserved: number;
  skipped: boolean;
}

/** Spreads `n` picks evenly over `count` positions, so what is set aside is a fair mix rather than the first few. */
export function spreadPicks(count: number, n: number): number[] {
  const k = Math.max(0, Math.min(n, count));
  return Array.from({ length: k }, (_, i) => Math.floor((i * count) / k));
}

export interface PlanOptions {
  choices?: ObjectiveChoices;
  /** Quiz questions per objective to set aside for the assessment instead of games and practice (0 for none). */
  reserve?: number;
}

export interface ImportPlan {
  objectives: PlannedObjective[];
  totals: Record<FileKind, { create: number; duplicate: number; invalid: number }>;
}

const zero = () => ({ create: 0, duplicate: 0, invalid: 0 });

/** What the import would do. `known` holds the fingerprints of what the module already has, so repeats are skipped. */
export function planImport(file: ContentFile, existing: ExistingObjective[], known: Set<string>, opts: PlanOptions = {}): ImportPlan {
  const matches = matchObjectives(file, existing, 0.7, opts.choices ?? {});
  const seen = new Set(known);
  const totals: ImportPlan["totals"] = { quiz: zero(), matching: zero(), ordering: zero(), scenario: zero() };
  const objectives = file.objectives.map((o, fileIndex): PlannedObjective => {
    const p: PlannedObjective = { fileIndex, number: o.number ?? fileIndex + 1, text: o.text.trim(), match: matches[fileIndex], counts: { quiz: zero(), matching: zero(), ordering: zero(), scenario: zero() }, invalid: [], quiz: [], items: [], reserved: 0, skipped: matches[fileIndex].how === "skipped" };
    if (p.skipped) return p;
    for (const kind of FILE_FORMATS) {
      (o[kind] as unknown[]).forEach((item, index) => {
        const sig = itemSignature(kind, item);
        const bad = (error: string) => {
          p.counts[kind].invalid++;
          totals[kind].invalid++;
          p.invalid.push({ kind, index, error });
        };
        if (kind === "quiz") {
          const c = cleanQuiz(item as FileQuiz);
          if (!c.ok) return bad(c.error);
          if (seen.has(sig)) { p.counts[kind].duplicate++; totals[kind].duplicate++; return; }
          seen.add(sig);
          p.quiz.push(c.quiz);
        } else {
          const format = GAME_FORMAT_OF[kind];
          const v = validateItemContent(format, item);
          if (!v.ok) return bad(v.error);
          if (seen.has(sig)) { p.counts[kind].duplicate++; totals[kind].duplicate++; return; }
          seen.add(sig);
          p.items.push({ format, content: v.content });
        }
        p.counts[kind].create++;
        totals[kind].create++;
      });
    }
    // Set some questions aside for the assessment: taken out of games and practice, not copied, so nothing is asked twice.
    const reserve = Math.min(opts.reserve ?? 0, Math.floor(p.quiz.length / 2));
    const picks = new Set(spreadPicks(p.quiz.length, reserve));
    p.quiz = p.quiz.map((q, i) => ({ ...q, pool: picks.has(i) ? "FORMAL" : "PRACTICE" }));
    p.reserved = picks.size;
    return p;
  });
  return { objectives, totals };
}

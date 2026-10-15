/**
 * Game results, the pure half: turns per-player, per-game answer counts from the three places games are played (course games, quiz
 * practice, games opened from the feed) into one row per player. No database here, so it is easy to test.
 */
export type ResultFormat = "QUIZ" | "MATCHING" | "ORDERING" | "SCENARIO";
export const RESULT_FORMATS: ResultFormat[] = ["QUIZ", "MATCHING", "ORDERING", "SCENARIO"];
export type ResultSource = "COURSE" | "FEED";

/** Answers one player gave in one game (or in quiz practice) from one source. */
export interface PlayCount {
  userId: string;
  gameId: string | null;
  format: ResultFormat;
  source: ResultSource;
  answers: number;
  correct: number;
  /** Sum of 0..1 scores (a half-right matching set counts 0.5). */
  scoreSum: number;
  first: Date | null;
  last: Date | null;
}

export interface PlayerIdentity {
  name: string;
  email: string;
  kind: string;
}

export interface PlayerRow extends PlayerIdentity {
  userId: string;
  sources: ResultSource[];
  games: number;
  answers: number;
  correct: number;
  /** Fully correct answers as a share of all answers, 0 to 100. */
  accuracy: number;
  /** Average score, 0 to 100 (partial credit counts). */
  averageScore: number;
  byFormat: Record<ResultFormat, { answers: number; correct: number }>;
  first: Date | null;
  last: Date | null;
}

const emptyFormats = (): PlayerRow["byFormat"] => ({ QUIZ: { answers: 0, correct: 0 }, MATCHING: { answers: 0, correct: 0 }, ORDERING: { answers: 0, correct: 0 }, SCENARIO: { answers: 0, correct: 0 } });
const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));
const earlier = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : a ?? b);
const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : a ?? b);

export function mergePlayers(counts: PlayCount[], identities: Map<string, PlayerIdentity>): PlayerRow[] {
  const by = new Map<string, { row: PlayerRow; games: Set<string>; scoreSum: number }>();
  for (const c of counts) {
    if (c.answers <= 0) continue;
    let cur = by.get(c.userId);
    if (!cur) {
      const who = identities.get(c.userId) ?? { name: "Unknown player", email: "", kind: "Unknown" };
      cur = { row: { userId: c.userId, ...who, sources: [], games: 0, answers: 0, correct: 0, accuracy: 0, averageScore: 0, byFormat: emptyFormats(), first: null, last: null }, games: new Set(), scoreSum: 0 };
      by.set(c.userId, cur);
    }
    const r = cur.row;
    if (!r.sources.includes(c.source)) r.sources.push(c.source);
    cur.games.add(c.gameId ?? `quiz:${c.format}`);
    r.answers += c.answers;
    r.correct += c.correct;
    cur.scoreSum += c.scoreSum;
    r.byFormat[c.format].answers += c.answers;
    r.byFormat[c.format].correct += c.correct;
    r.first = earlier(r.first, c.first);
    r.last = later(r.last, c.last);
  }
  return [...by.values()]
    .map(({ row, games, scoreSum }) => ({ ...row, games: games.size, accuracy: pct(row.correct, row.answers), averageScore: pct(scoreSum, row.answers), sources: row.sources.sort() }))
    .sort((a, b) => (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0));
}

export interface ResultsSummary {
  players: number;
  activeLast7Days: number;
  answers: number;
  accuracy: number;
}

export function summarize(rows: PlayerRow[], now: Date = new Date()): ResultsSummary {
  const week = now.getTime() - 7 * 86_400_000;
  const answers = rows.reduce((n, r) => n + r.answers, 0);
  const correct = rows.reduce((n, r) => n + r.correct, 0);
  return { players: rows.length, activeLast7Days: rows.filter((r) => (r.last?.getTime() ?? 0) >= week).length, answers, accuracy: pct(correct, answers) };
}

export const PLAYER_KIND_LABEL: Record<string, string> = { TRAINEE: "Trainee", EMPLOYER: "Employer", INVESTOR: "Investor", STAFF: "Staff", ORGANIZATION: "Organization" };

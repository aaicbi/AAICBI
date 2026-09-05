/**
 * The pure half of M13's performance analysis — same split rationale
 * as every other *Core.ts file in this project: no Prisma import, no
 * AI call, testable without either. src/lib/ai/analyzePerformance.ts
 * is the AI-dependent half that turns this into a narrative;
 * examEngine.ts is where both get called from.
 */

export interface TopicAnswer {
  /** null/empty means the question had no topic classified — bucketed
   * under "General" rather than dropped, so nothing about a trainee's
   * performance goes uncounted just because a question's topic label
   * is missing. */
  topic: string | null;
  isCorrect: boolean;
  /** M13 audit finding: whether the trainee actually attempted this
   * question at all, tracked separately from `isCorrect`. Both an
   * unanswered question and a wrongly-answered one score as "not
   * correct" toward the topic total (see the comment on
   * computeTopicStats for why that has to stay true for the score
   * itself) — but they mean very different things about what a
   * trainee actually demonstrated. Someone who ran out of time and
   * never saw half a topic's questions hasn't shown they don't
   * understand that material, only that they didn't get to it. Feeding
   * this through lets the AI-generation step (analyzePerformance.ts)
   * hedge its language accordingly instead of stating a confident
   * "weakness" it doesn't actually have evidence for. */
  answered: boolean;
}

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
  /** How many of `total` were never answered at all — see the comment
   * on TopicAnswer.answered above. */
  unanswered: number;
}

const UNTAGGED_TOPIC_LABEL = "General";

/**
 * Groups per-question results into per-topic correct/total counts.
 * Deliberately takes ALL of an attempt's assigned questions, not just
 * the ones the trainee actually answered — an unanswered question
 * (ran out of time, skipped) counts as incorrect for its topic, the
 * same way it already counts against the trainee's overall percentage
 * (examEngine.ts's submitAttempt scores unanswered questions as wrong
 * via the total-questions denominator). Building topic stats from only
 * ANSWERED questions would make a topic look artificially strong if a
 * trainee attempted one question in it and ran out of time before the
 * other three. `unanswered` is tracked alongside so a consumer (the AI
 * narrative) can tell the difference between "wrong" and "never
 * attempted" even though both count against the same total — see
 * TopicAnswer.answered.
 *
 * Sorted by total descending (topics with more questions first) — a
 * reasonable default ordering for feeding into a summary, though the
 * AI-generation step doesn't strictly depend on this order.
 */
export function computeTopicStats(answers: TopicAnswer[]): TopicStat[] {
  const byTopic = new Map<string, { correct: number; total: number; unanswered: number }>();
  for (const a of answers) {
    const topic = a.topic?.trim() || UNTAGGED_TOPIC_LABEL;
    const entry = byTopic.get(topic) ?? { correct: 0, total: 0, unanswered: 0 };
    entry.total += 1;
    if (a.isCorrect) entry.correct += 1;
    if (!a.answered) entry.unanswered += 1;
    byTopic.set(topic, entry);
  }
  return [...byTopic.entries()]
    .map(([topic, { correct, total, unanswered }]) => ({ topic, correct, total, unanswered }))
    .sort((a, b) => b.total - a.total);
}

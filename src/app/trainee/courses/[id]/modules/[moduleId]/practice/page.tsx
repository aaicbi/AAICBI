"use client";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import BackLink from "@/components/ui/BackLink";
import Icon from "@/components/ui/Icon";
import { CheckCircle2, Flame, Lightbulb, Sparkles, Trophy, XCircle } from "lucide-react";
import { TRAINEE_NAV } from "@/lib/trainee/nav";
import Companion from "@/components/games/experience/Companion";
import Confetti from "@/components/games/experience/Confetti";
import RoundHud from "@/components/games/experience/RoundHud";
import RoundIntro from "@/components/games/experience/RoundIntro";
import RoundSummary from "@/components/games/experience/RoundSummary";
import { useRound } from "@/components/games/experience/useRound";

type MasteryState = "NOT_STARTED" | "LEARNING" | "NEARLY_THERE" | "MASTERED" | "NEEDS_REFRESH";

interface Mastery {
  state: MasteryState;
  distinctCorrect: number;
  accuracyPercent: number | null;
  days: number;
  answered: number;
  progress: number;
  needs: string[];
}
interface Objective {
  id: string;
  text: string;
  isCritical: boolean;
  questions: number;
  mastery: Mastery;
}
interface Overview {
  module: { id: string; title: string; courseId: string; courseTitle: string };
  objectives: Objective[];
  masteredCount: number;
  xp: { module: number; total: number; today: number; dailyCap: number };
  streak: number;
  level: { level: "EXPLORER" | "PROBLEM_SOLVER"; nextLevel: string | null; masteredPercent: number; neededForNext: number; masteredObjectives: number; totalObjectives: number };
  rewards: string[];
  formal: { required: boolean; met: boolean; requiredPercent: number; masteredObjectives: number; totalObjectives: number };
}
interface Served {
  done: false;
  practiceAnswerId: string;
  objective: { id: string; text: string };
  question: { text: string; options: { key: string; text: string }[] };
  minSeconds: number;
  hintUsed: boolean;
}
interface Hint {
  objective: string;
  sources: { material: string; lesson: string }[];
  courseUrl: string;
}
interface Result {
  correct: boolean;
  correctOptionKey: string | null;
  explanation: string | null;
  tooFast: boolean;
  minSeconds: number;
  sources: { material: string; lesson: string }[];
  courseUrl: string;
  xp?: { earned: number; answer: number; missedBonus: number; streak: number; objective: number; module: number; cappedByDailyLimit: boolean; today: number; dailyCap: number; total: number };
  streakDays?: number;
  mastery?: Mastery;
  objectiveJustMastered?: boolean;
  moduleCompleted?: boolean;
}

const STATE_LABEL: Record<MasteryState, string> = {
  NOT_STARTED: "Not started",
  LEARNING: "Learning",
  NEARLY_THERE: "Nearly there",
  MASTERED: "Mastered",
  NEEDS_REFRESH: "Needs refresh",
};
const STATE_VARIANT: Record<MasteryState, "neutral" | "warning" | "success" | "gold"> = {
  NOT_STARTED: "neutral",
  LEARNING: "neutral",
  NEARLY_THERE: "warning",
  MASTERED: "success",
  NEEDS_REFRESH: "warning",
};
const LEVEL_LABEL = { EXPLORER: "Explorer", PROBLEM_SOLVER: "Problem Solver" } as const;

function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-full bg-brand-gray/60"
    >
      <div className="h-full rounded-full bg-brand-action transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-brand-gray bg-brand-surface px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {icon} {label}
      </p>
      <p className="mt-1 text-xl font-bold text-brand-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-600">{hint}</p>}
    </div>
  );
}

export default function PracticePage({ params }: { params: { id: string; moduleId: string } }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [current, setCurrent] = useState<Served | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  // A 10-question round wraps the practice flow. `session` is set from the moment a learner starts practising until they go back.
  const [session, setSession] = useState<{ objectiveId: string | null; title: string } | null>(null);
  const round = useRound();
  const base = `/api/modules/${params.moduleId}/practice`;

  const loadOverview = useCallback(async () => {
    const res = await fetch(base);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUnavailable(data.error ?? "Practice isn't available for this module yet.");
      return;
    }
    setOverview(await res.json());
  }, [base]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function start(objectiveId: string | null) {
    setBusy(true);
    setError(null);
    setEmptyMessage(null);
    setResult(null);
    setHint(null);
    setSelected(null);
    const res = await fetch(`${base}/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectiveId }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not load a question. Please try again.");
      return;
    }
    if (data.done) {
      setCurrent(null);
      if (round.finishEarly()) return;
      setEmptyMessage(data.message ?? "There are no practice questions to serve right now.");
      return;
    }
    setCurrent(data as Served);
    // Bring the question into view on a phone.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function showHint() {
    if (!current) return;
    const res = await fetch(`${base}/hint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceAnswerId: current.practiceAnswerId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setHint(data.hint as Hint);
    else setError(data.error ?? "Could not load the hint.");
  }

  async function submit() {
    if (!current || !selected) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`${base}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceAnswerId: current.practiceAnswerId, selectedKey: selected }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not record your answer. Please try again.");
      return;
    }
    const graded = data as Result;
    setResult(graded);
    round.report({
      key: current.practiceAnswerId,
      item: { format: "QUIZ", served: { question: current.question.text, options: current.question.options } },
      result: { correct: graded.correct, score: graded.correct ? 1 : 0, feedback: { correctOptionKey: graded.correctOptionKey }, xp: graded.xp },
    });
    void loadOverview();
  }

  /** Opens a round: the welcome (and, the first time in a visit, the countdown) comes first, and no question is fetched until it ends. */
  function beginRound(objectiveId: string | null, title: string) {
    round.reset();
    setSession({ objectiveId, title });
    setError(null);
    setEmptyMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function nextQuestion() {
    if (round.advance()) return;
    void start(current?.objective.id ?? session?.objectiveId ?? null);
  }

  function backToObjectives() {
    setSession(null);
    round.reset();
    setCurrent(null);
    setResult(null);
    setHint(null);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const courseHref = `/trainee/courses/${params.id}`;

  if (unavailable) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center text-gray-600 sm:px-6">
          <p>{unavailable}</p>
          <p className="mt-4">
            <BackLink href={courseHref}>Back to the course</BackLink>
          </p>
        </main>
      </>
    );
  }

  if (!overview) {
    return (
      <>
        <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center text-gray-500 sm:px-6">Loading practice…</main>
      </>
    );
  }

  const lv = overview.level;

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <BackLink href={courseHref}>{overview.module.courseTitle}</BackLink>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Practice: {overview.module.title}</h1>
        <p className="mt-1 text-sm text-gray-700">
          Practice mode is for learning. There is no timer, wrong answers cost nothing, and the XP you earn here never counts
          toward your certificate. Only the formal assessment does.
        </p>

        <section aria-label="Your progress" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Icon icon={Trophy} size="sm" />} label="Level" value={LEVEL_LABEL[lv.level]} hint={lv.nextLevel ? `Master ${lv.neededForNext} more objective${lv.neededForNext === 1 ? "" : "s"} in this course to level up` : "Top level for now"} />
          <Stat icon={<Icon icon={Flame} size="sm" />} label="Streak" value={`${overview.streak} day${overview.streak === 1 ? "" : "s"}`} hint={overview.streak >= 2 ? "Keep it going tomorrow" : "Practise on consecutive days"} />
          <Stat icon={<Icon icon={Sparkles} size="sm" />} label="XP today" value={`${Math.min(overview.xp.today, overview.xp.dailyCap)} / ${overview.xp.dailyCap}`} hint={overview.xp.today >= overview.xp.dailyCap ? "Daily XP goal reached. Mastery still counts." : undefined} />
          <Stat icon={<Icon icon={CheckCircle2} size="sm" />} label="Mastered" value={`${overview.masteredCount} of ${overview.objectives.length}`} hint={`${overview.xp.module} XP in this module`} />
        </section>

        {overview.formal.required && (
          <Card className="mt-4" variant={overview.formal.met ? "highlighted" : "default"}>
            <p className="text-sm text-brand-ink">
              <span className="font-semibold">Assessment unlock:</span>{" "}
              {overview.formal.met
                ? "You've practised enough. The formal assessment is open."
                : `master at least ${overview.formal.requiredPercent}% of the objectives (${overview.formal.masteredObjectives} of ${overview.formal.totalObjectives} so far) to unlock the formal assessment.`}
            </p>
          </Card>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-brand-roseLight px-4 py-3 text-sm text-brand-rose">
            {error}
          </p>
        )}

        {session && round.phase === "intro" ? (
          <section aria-label="Start of the round" className="mt-6">
            <Card>
              <RoundIntro
                title={session.title}
                size={round.round.size}
                roundNo={round.roundNo}
                welcome={round.message}
                countdown={round.countdown}
                onStart={round.start}
                onReady={() => {
                  round.ready();
                  void start(session.objectiveId);
                }}
              />
              <div className="mt-2 text-center">
                <Button variant="ghost" size="sm" onClick={backToObjectives}>
                  Back to objectives
                </Button>
              </div>
            </Card>
          </section>
        ) : session && round.phase === "summary" ? (
          <section aria-label="Round summary" className="mt-6">
            <Card>
              <RoundSummary
                round={round.round}
                xp={round.xp}
                onAgain={() => {
                  round.again();
                  void start(session.objectiveId);
                }}
                onExit={backToObjectives}
                exitLabel="Back to objectives"
              />
            </Card>
          </section>
        ) : session && !current ? (
          <section aria-label="Practice question" className="mt-6">
            <Card>
              {emptyMessage ? (
                <div className="space-y-3 text-sm text-gray-700">
                  <p>{emptyMessage}</p>
                  <Button variant="secondary" onClick={backToObjectives}>
                    Back to objectives
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Getting your first question…</p>
              )}
            </Card>
          </section>
        ) : current ? (
          <section aria-label="Practice question" className="mt-6 space-y-4">
            <Confetti burst={round.confetti.burst} strength={round.confetti.strength} />
            {session && (
              <>
                <RoundHud
                  current={round.current}
                  size={round.round.size}
                  outcomes={round.round.answers.map((a) => a.outcome)}
                  correct={round.round.answers.filter((a) => a.outcome === "FULL").length}
                  xp={round.xp}
                  streak={round.round.streak}
                  soundOn={round.sound.enabled}
                  onToggleSound={round.sound.toggle}
                />
                <Companion mood={round.mood} message={round.message} messageKey={round.messageKey} achievement={round.achievement} />
              </>
            )}
            <Card>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Objective</p>
              <p className="mt-0.5 text-sm text-brand-ink">{current.objective.text}</p>

              <h2 key={current.practiceAnswerId} className="gx-rise mt-4 text-lg font-semibold text-brand-ink">{current.question.text}</h2>

              <fieldset className="mt-4 space-y-2" disabled={!!result}>
                <legend className="sr-only">Choose one answer</legend>
                {current.question.options.map((o, oi) => {
                  const isSelected = selected === o.key;
                  const showCorrect = result && result.correctOptionKey === o.key;
                  const showWrong = result && isSelected && !result.correct;
                  return (
                    <button
                      key={o.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        round.sound.play("select");
                        setSelected(o.key);
                      }}
                      style={{ "--i": oi } as React.CSSProperties}
                      className={`gx-stagger flex min-h-[48px] w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm transition-[transform,border-color,background-color] duration-150 active:scale-[0.99] ${showCorrect ? "gx-pop gx-ring " : ""}${showWrong ? "gx-shake " : ""}${
                        showCorrect
                          ? "border-brand-teal bg-brand-mint text-brand-ink"
                          : showWrong
                            ? "border-brand-rose bg-brand-roseLight/60 text-brand-ink"
                            : isSelected
                              ? "border-brand-action bg-brand-mint/50 text-brand-ink"
                              : "border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"
                      }`}
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                        {o.key}
                      </span>
                      <span className="flex-1">{o.text}</span>
                      {showCorrect && <Icon icon={CheckCircle2} size="sm" label="Correct answer" />}
                      {showWrong && <Icon icon={XCircle} size="sm" label="Your answer" />}
                    </button>
                  );
                })}
              </fieldset>

              {!result && (
                <>
                  {hint && (
                    <div className="mt-4 rounded-2xl bg-brand-goldLight/50 px-4 py-3 text-sm text-brand-ink" role="note">
                      <p className="font-semibold">Hint</p>
                      {hint.sources.length > 0 ? (
                        <ul className="mt-1 list-disc pl-5">
                          {hint.sources.map((s) => (
                            <li key={`${s.lesson}-${s.material}`}>
                              Revisit <span className="font-medium">{s.material}</span> in the lesson &ldquo;{s.lesson}&rdquo;.
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1">Revise this objective: {hint.objective}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-700">Using a hint halves the XP for a correct answer.</p>
                    </div>
                  )}
                  <p className="mt-4 text-xs text-gray-600">
                    Take your time. Answers given too quickly (under about {current.minSeconds} seconds for this question) earn no XP and
                    don&apos;t count as evidence of mastery.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button onClick={submit} disabled={!selected || busy} loading={busy}>
                      Check answer
                    </Button>
                    {!hint && (
                      <Button variant="secondary" onClick={showHint} iconLeft={<Icon icon={Lightbulb} size="sm" />}>
                        Show a hint
                      </Button>
                    )}
                    <Button variant="ghost" onClick={backToObjectives}>
                      Back to objectives
                    </Button>
                  </div>
                </>
              )}

              {result && (
                <div aria-live="polite" className="gx-rise mt-5 space-y-3">
                  <div className={`rounded-2xl px-4 py-3 ${result.correct ? "bg-brand-mint" : "bg-brand-roseLight/60"}`}>
                    <p className="flex items-center gap-2 font-semibold text-brand-ink">
                      <Icon icon={result.correct ? CheckCircle2 : XCircle} size="md" />
                      {result.correct ? "Correct" : "Not quite"}
                    </p>
                    {result.explanation && <p className="mt-1 text-sm text-brand-ink">{result.explanation}</p>}
                    {!result.correct && result.sources.length > 0 && (
                      <p className="mt-2 text-sm text-brand-ink">
                        Revise: {result.sources.map((s) => `${s.material} (${s.lesson})`).join(", ")}.{" "}
                        <a className="font-semibold text-brand-teal underline" href={result.courseUrl}>
                          Open the course
                        </a>
                      </p>
                    )}
                  </div>

                  {result.tooFast && (
                    <p className="rounded-xl bg-brand-goldLight/50 px-4 py-2 text-sm text-brand-ink">
                      That was quick. Answers under {result.minSeconds} seconds earn no XP and don&apos;t count toward mastery. Slow down
                      and read each option.
                    </p>
                  )}

                  {result.xp && result.xp.earned > 0 && (
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-ink">
                      <Badge variant="gold">+{result.xp.earned} XP</Badge>
                      {result.xp.missedBonus > 0 && <Badge variant="success">+{result.xp.missedBonus} for fixing a missed question</Badge>}
                      {result.xp.streak > 0 && <Badge variant="success">+{result.xp.streak} streak bonus</Badge>}
                      {result.xp.objective > 0 && <Badge variant="gold">+{result.xp.objective} objective mastered</Badge>}
                      {result.xp.module > 0 && <Badge variant="gold">+{result.xp.module} module completed</Badge>}
                    </p>
                  )}
                  {result.xp && result.xp.earned === 0 && result.correct && !result.tooFast && (
                    <p className="text-xs text-gray-600">
                      {result.xp.cappedByDailyLimit
                        ? "You've reached today's XP goal. Mastery still counts."
                        : "No XP this time: this question already earned XP today."}
                    </p>
                  )}

                  {result.objectiveJustMastered && (
                    <p className="rounded-2xl bg-brand-goldLight px-4 py-3 text-sm font-semibold text-brand-goldText">
                      You mastered this objective.{result.moduleCompleted ? " That completes every objective in this module." : ""}
                    </p>
                  )}

                  {result.mastery && (
                    <div>
                      <p className="flex items-center justify-between text-xs text-gray-700">
                        <span>This objective: {STATE_LABEL[result.mastery.state]}</span>
                        <span>{result.mastery.distinctCorrect} different questions correct</span>
                      </p>
                      <div className="mt-1">
                        <ProgressBar value={result.mastery.progress} label="Progress toward mastering this objective" />
                      </div>
                      {result.mastery.needs.length > 0 && (
                        <p className="mt-1 text-xs text-gray-600">Still needed: {result.mastery.needs.join("; ")}.</p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={nextQuestion} disabled={busy}>
                      {round.round.answers.length >= round.round.size ? "See my results" : "Next question"}
                    </Button>
                    <Button variant="secondary" onClick={backToObjectives}>
                      Back to objectives
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </section>
        ) : (
          <section aria-label="Objectives" className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-brand-ink">Objectives</h2>
              <Button onClick={() => beginRound(null, "Practise what needs work")} disabled={busy} loading={busy}>
                Practise what needs work
              </Button>
            </div>
            {emptyMessage && <p className="mt-3 text-sm text-gray-600">{emptyMessage}</p>}
            <ul className="mt-3 space-y-3">
              {overview.objectives.map((o) => (
                <li key={o.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 basis-full break-words text-sm font-medium text-brand-ink sm:basis-0 sm:flex-1">{o.text}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        
                        <Badge variant={STATE_VARIANT[o.mastery.state]}>{STATE_LABEL[o.mastery.state]}</Badge>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={o.mastery.progress} label={`Progress on: ${o.text}`} />
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      {o.mastery.answered === 0
                        ? `${o.questions} practice questions available`
                        : `${o.mastery.distinctCorrect} different questions correct${o.mastery.accuracyPercent !== null ? ` · ${o.mastery.accuracyPercent}% recent accuracy` : ""} · practised on ${o.mastery.days} day${o.mastery.days === 1 ? "" : "s"}`}
                    </p>
                    {o.mastery.state !== "MASTERED" && o.mastery.needs.length > 0 && (
                      <p className="mt-1 text-xs text-gray-600">To master it: {o.mastery.needs.join("; ")}.</p>
                    )}
                    <div className="mt-3">
                      <Button size="sm" variant="secondary" onClick={() => beginRound(o.id, o.text)} disabled={busy || o.questions === 0}>
                        {o.mastery.state === "NOT_STARTED" ? "Start practising" : o.mastery.state === "MASTERED" ? "Practise again" : "Keep practising"}
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

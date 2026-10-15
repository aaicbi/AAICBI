"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, XCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";

/**
 * One player for every game format, used both by trainees (recording real
 * plays and paying XP) and by the Game Studio preview (recording nothing).
 * It never holds an answer key: items arrive shuffled without one, and the
 * answer is graded by the server, which sends feedback back afterwards.
 */

export type PlayFormat = "QUIZ" | "MATCHING" | "ORDERING" | "SCENARIO";

export type PlayServed =
  | { format: "QUIZ"; question: string; options: { key: string; text: string }[] }
  | { format: "MATCHING"; prompt: string; lefts: string[]; rights: string[] }
  | { format: "ORDERING"; prompt: string; steps: string[] }
  | { format: "SCENARIO"; situation: string; options: string[] };

export interface PlayItem {
  /** Trainees: the recorded play. Preview: the item id. */
  playId: string;
  format: PlayFormat;
  objective: string;
  served: PlayServed;
  minSeconds?: number;
  /** Preview only: DRAFT items are marked so authors know what trainees would not see yet. */
  status?: string;
  index?: number;
  total?: number;
}

export interface PlayResult {
  score: number;
  correct: boolean;
  tooFast?: boolean;
  minSeconds?: number;
  feedback: Record<string, unknown>;
  xp?: { earned: number; streak?: number; objective?: number; module?: number; today: number; dailyCap: number; cappedByDailyLimit: boolean };
  mastery?: { state: string; distinctCorrect: number; progress: number; needs: string[] };
  objectiveJustMastered?: boolean;
  moduleCompleted?: boolean;
}

export interface PlayerApi {
  next: () => Promise<{ item?: PlayItem; done?: boolean; error?: string }>;
  answer: (item: PlayItem, response: unknown) => Promise<{ result?: PlayResult; error?: string }>;
}

const OPTION_STYLE = [
  { chip: "bg-brand-teal text-brand-onAccent", bar: "border-l-brand-teal" },
  { chip: "bg-brand-gold text-brand-onGold", bar: "border-l-brand-gold" },
  { chip: "bg-brand-rose text-brand-onAccent", bar: "border-l-brand-rose" },
  { chip: "bg-brand-green text-brand-onAccent", bar: "border-l-brand-green" },
];

function pairColor(i: number): string {
  return ["bg-brand-teal text-brand-onAccent", "bg-brand-gold text-brand-onGold", "bg-brand-rose text-brand-onAccent", "bg-brand-green text-brand-onAccent", "bg-brand-tealDeep text-brand-onAccent", "bg-brand-ink text-brand-surface"][i % 6];
}

function Matching({ served, disabled, result, onChange }: { served: Extract<PlayServed, { format: "MATCHING" }>; disabled: boolean; result: PlayResult | null; onChange: (r: unknown | null) => void }) {
  const [pairs, setPairs] = useState<Record<number, string>>({});
  const [activeLeft, setActiveLeft] = useState<number | null>(null);
  const feedback = result?.feedback as { pairs?: { left: string; right: string; chosen: string; ok: boolean }[] } | undefined;

  useEffect(() => {
    onChange(Object.keys(pairs).length === served.lefts.length ? { matches: Object.fromEntries(Object.entries(pairs).map(([k, v]) => [k, v])) } : null);
  }, [pairs, served.lefts.length, onChange]);

  const rightOwner = (text: string) => Object.entries(pairs).find(([, v]) => v === text)?.[0];

  const pickLeft = (i: number) => {
    if (disabled) return;
    if (pairs[i] !== undefined) {
      const next = { ...pairs };
      delete next[i];
      setPairs(next);
      setActiveLeft(i);
      return;
    }
    // Tapping the term that is already highlighted keeps it highlighted: after a match the next term is picked for you.
    setActiveLeft(i);
  };
  const pickRight = (text: string) => {
    if (disabled) return;
    const owner = rightOwner(text);
    if (owner !== undefined) {
      const next = { ...pairs };
      delete next[Number(owner)];
      setPairs(next);
      return;
    }
    if (activeLeft === null) return;
    setPairs({ ...pairs, [activeLeft]: text });
    // Move on to the next term still waiting for a partner.
    const waiting = served.lefts.findIndex((_, i) => i !== activeLeft && pairs[i] === undefined);
    setActiveLeft(waiting >= 0 ? waiting : null);
  };

  return (
    <div>
      <p className="text-sm text-gray-700">Tap a term, then tap its meaning. Tap a matched card to undo it.</p>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ul className="space-y-2" aria-label="Terms">
          {served.lefts.map((l, i) => {
            const paired = pairs[i] !== undefined;
            const res = feedback?.pairs?.[i];
            return (
              <li key={l} className="gx-stagger" style={{ "--i": i } as React.CSSProperties}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={activeLeft === i}
                  onClick={() => pickLeft(i)}
                  className={`flex min-h-[52px] w-full items-center gap-2 rounded-2xl border border-l-[6px] border-l-brand-teal px-3 py-2 text-left text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
                    res ? (res.ok ? "border-brand-teal bg-brand-mint" : "border-brand-rose bg-brand-roseLight/60") : activeLeft === i ? "border-brand-action bg-brand-mint/60 ring-2 ring-brand-action/30" : "border-brand-gray bg-brand-surface hover:border-brand-teal"
                  }`}
                >
                  {paired && <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pairColor(i)}`}>{i + 1}</span>}
                  <span className="flex-1">{l}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2" aria-label="Meanings">
          {served.rights.map((r, ri) => {
            const owner = rightOwner(r);
            const res = feedback?.pairs?.find((p) => p.chosen === r);
            return (
              <li key={r} className="gx-stagger" style={{ "--i": ri } as React.CSSProperties}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => pickRight(r)}
                  className={`flex min-h-[52px] w-full items-center gap-2 rounded-2xl border border-l-[6px] border-l-brand-gold px-3 py-2 text-left text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
                    res ? (res.ok ? "border-brand-teal bg-brand-mint" : "border-brand-rose bg-brand-roseLight/60") : owner !== undefined ? "border-brand-action bg-brand-mint/40" : "border-brand-gray bg-brand-surface hover:border-brand-teal"
                  }`}
                >
                  {owner !== undefined && <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${pairColor(Number(owner))}`}>{Number(owner) + 1}</span>}
                  <span className="flex-1">{r}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {feedback?.pairs && feedback.pairs.some((p) => !p.ok) && (
        <div className="mt-3 rounded-2xl bg-brand-surface p-3 text-sm text-brand-ink">
          <p className="font-semibold">The right matches</p>
          <ul className="mt-1 space-y-0.5">
            {feedback.pairs.map((p) => (
              <li key={p.left}>
                <span className="font-medium">{p.left}</span> → {p.right}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Ordering({ served, disabled, result, onChange }: { served: Extract<PlayServed, { format: "ORDERING" }>; disabled: boolean; result: PlayResult | null; onChange: (r: unknown | null) => void }) {
  const [order, setOrder] = useState<string[]>(served.steps);
  const feedback = result?.feedback as { correctOrder?: string[]; positions?: boolean[] } | undefined;

  useEffect(() => {
    onChange({ order });
  }, [order, onChange]);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <div>
      <p className="text-sm text-gray-700">Use the arrows to put the steps in the right order, first at the top.</p>
      <ol className="mt-3 space-y-2">
        {order.map((step, i) => {
          const ok = feedback?.positions?.[i];
          return (
            <li
              key={step}
              style={{ "--i": i } as React.CSSProperties}
              className={`gx-stagger flex items-center gap-2 rounded-2xl border border-l-[6px] border-l-brand-teal px-3 py-2 text-sm font-medium shadow-sm ${ok === undefined ? "border-brand-gray bg-brand-surface" : ok ? "border-brand-teal bg-brand-mint" : "border-brand-rose bg-brand-roseLight/60"}`}
            >
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold shadow ${pairColor(i)}`}>{i + 1}</span>
              <span className="flex-1">{step}</span>
              {!disabled && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Move “${step}” up`} onClick={() => move(i, -1)} disabled={i === 0} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gray bg-brand-surface transition-transform hover:scale-110 hover:bg-brand-mint active:scale-95 disabled:opacity-30">
                    <Icon icon={ArrowUp} size="sm" />
                  </button>
                  <button type="button" aria-label={`Move “${step}” down`} onClick={() => move(i, 1)} disabled={i === order.length - 1} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-gray bg-brand-surface transition-transform hover:scale-110 hover:bg-brand-mint active:scale-95 disabled:opacity-30">
                    <Icon icon={ArrowDown} size="sm" />
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {feedback?.correctOrder && !result?.correct && (
        <div className="mt-3 rounded-2xl bg-brand-surface p-3 text-sm text-brand-ink">
          <p className="font-semibold">The right order</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {feedback.correctOrder.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Choices({ options, selected, onSelect, disabled, result, correctKey }: { options: { key: string; text: string }[]; selected: string | null; onSelect: (k: string) => void; disabled: boolean; result: PlayResult | null; correctKey?: string | null }) {
  return (
    <fieldset className="mt-4 space-y-2" disabled={disabled}>
      <legend className="sr-only">Choose one answer</legend>
      {options.map((o, i) => {
        const isSelected = selected === o.key;
        const isCorrect = result && correctKey === o.key;
        const isWrong = result && isSelected && !result.correct;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(o.key)}
            style={{ "--i": i } as React.CSSProperties}
            className={`gx-stagger flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-l-[6px] ${OPTION_STYLE[i % 4].bar} px-3 py-3 text-left text-sm font-medium shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${isCorrect ? "gx-pop gx-ring " : ""}${isWrong ? "gx-shake " : ""}${
              isCorrect ? "border-brand-teal bg-brand-mint" : isWrong ? "border-brand-rose bg-brand-roseLight/60" : isSelected ? "scale-[1.01] border-brand-action bg-brand-mint/60 ring-2 ring-brand-action/40" : "border-brand-gray bg-brand-surface hover:border-brand-teal"
            }`}
          >
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold shadow ${OPTION_STYLE[i % 4].chip}`}>{String.fromCharCode(65 + i)}</span>
            <span className="flex-1">{o.text}</span>
            {isCorrect && <Icon icon={CheckCircle2} size="sm" label="Best choice" />}
            {isWrong && <Icon icon={XCircle} size="sm" label="Your choice" />}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Optional hooks a 10-question round uses to follow the player. Without them the player behaves exactly as before. */
export interface RoundHooks {
  /** Called once with the server's graded result. */
  onResult: (item: PlayItem, result: PlayResult) => void;
  /** Called when the learner moves on. Returns true when the round is over, which stops another question loading. */
  onAdvance: () => boolean;
  /** Called when the server has nothing more to serve. Returns true when the round took over (a summary is showing). */
  onDone: () => boolean;
  /** Called when the learner picks something, for the tap sound. */
  onInteract?: () => void;
  nextLabel: string;
}

export default function GamePlayer({ api, mode, onEmpty, hooks }: { api: PlayerApi; mode: "play" | "preview"; onEmpty?: React.ReactNode; hooks?: RoundHooks }) {
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;
  const [item, setItem] = useState<PlayItem | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<unknown | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const loadedAt = useRef<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setResponse(null);
    setChoice(null);
    setRound((n) => n + 1);
    const r = await api.next();
    setLoading(false);
    if (r.error) return setError(r.error);
    if (r.done || !r.item) {
      setItem(null);
      if (hooksRef.current?.onDone()) return;
      return setEmpty(true);
    }
    setEmpty(false);
    setItem(r.item);
    loadedAt.current = Date.now();
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = useCallback((r: unknown | null) => setResponse(r), []);

  async function check() {
    if (!item) return;
    const payload = item.format === "QUIZ" || item.format === "SCENARIO" ? (choice !== null ? { choice } : null) : response;
    if (!payload) return;
    setBusy(true);
    setError(null);
    const r = await api.answer(item, payload);
    setBusy(false);
    if (r.error) return setError(r.error);
    setResult(r.result ?? null);
    if (r.result) hooksRef.current?.onResult(item, r.result);
  }

  function next() {
    if (hooksRef.current?.onAdvance()) return;
    void load();
  }

  const select = (k: string) => {
    hooksRef.current?.onInteract?.();
    setChoice(k);
  };

  if (loading && !item) return <p className="text-sm text-gray-500">Loading…</p>;
  if (empty || !item) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-gray p-6 text-center text-sm text-gray-600">
        {error ?? onEmpty ?? "Nothing to play yet."}
      </div>
    );
  }

  const served = item.served;
  const answered = result !== null;
  const canCheck = item.format === "MATCHING" || item.format === "ORDERING" ? response !== null : choice !== null;
  const quizKey = (result?.feedback as { correctOptionKey?: string | null } | undefined)?.correctOptionKey ?? null;

  return (
    <div data-testid="game-player" data-format={item.format}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="font-semibold uppercase tracking-wide">Objective</span>
        <span className="text-brand-ink">{item.objective}</span>
        {mode === "preview" && item.status === "DRAFT" && <Badge variant="warning">Draft: trainees can't see this yet</Badge>}
        {mode === "preview" && item.total ? <span className="ml-auto">{(item.index ?? 0) + 1} of {item.total}</span> : null}
      </div>

      <div key={`${item.playId}-${round}`} className="gx-rise mt-3">
        {served.format === "QUIZ" && (
          <>
            <h3 className="font-display text-lg font-bold leading-snug text-brand-ink">{served.question}</h3>
            <Choices options={served.options} selected={choice} onSelect={select} disabled={answered} result={result} correctKey={quizKey} />
          </>
        )}
        {served.format === "SCENARIO" && (
          <>
            <h3 className="font-display text-lg font-bold leading-snug text-brand-ink">{served.situation}</h3>
            <p className="mt-1 text-sm text-gray-700">What would you do?</p>
            <Choices options={served.options.map((t) => ({ key: t, text: t }))} selected={choice} onSelect={select} disabled={answered} result={result} correctKey={(result?.feedback as { best?: string } | undefined)?.best ?? null} />
          </>
        )}
        {served.format === "MATCHING" && (
          <>
            <h3 className="mb-2 font-display text-lg font-bold leading-snug text-brand-ink">{served.prompt}</h3>
            <Matching key={`${item.playId}-${round}`} served={served} disabled={answered} result={result} onChange={onChange} />
          </>
        )}
        {served.format === "ORDERING" && (
          <>
            <h3 className="mb-2 font-display text-lg font-bold leading-snug text-brand-ink">{served.prompt}</h3>
            <Ordering key={`${item.playId}-${round}`} served={served} disabled={answered} result={result} onChange={onChange} />
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">
          {error}
        </p>
      )}

      {!answered && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={!canCheck || busy} loading={busy} className={`min-h-[48px] px-7 text-base font-extrabold ${canCheck && !busy ? "gx-pulse" : ""}`}>
            Check answer
          </Button>
          {mode === "preview" && (
            <Button variant="ghost" onClick={() => void load()}>
              Next item
            </Button>
          )}
          {mode === "play" && item.minSeconds ? <span className="text-xs text-gray-600">Take your time: answers under about {item.minSeconds} seconds earn no XP.</span> : null}
        </div>
      )}

      {answered && result && (
        <div aria-live="polite" className="gx-rise mt-4 space-y-3">
          <div className={`rounded-2xl px-4 py-3 ${result.correct ? "bg-brand-mint" : result.score > 0 ? "bg-brand-goldLight/60" : "bg-brand-roseLight/60"}`}>
            <p className="flex items-center gap-2 font-semibold text-brand-ink">
              <Icon icon={result.correct ? CheckCircle2 : result.score > 0 ? Check : XCircle} size="md" />
              {result.correct ? "Correct" : result.score > 0 ? `${Math.round(result.score * 100)}% right` : "Not quite"}
            </p>
            {item.format === "SCENARIO" && (() => {
              const f = result.feedback as { outcome?: string; best?: string; bestOutcome?: string };
              return (
                <div className="mt-1 text-sm text-brand-ink">
                  {f.outcome && <p>{f.outcome}</p>}
                  {!result.correct && f.best && (
                    <p className="mt-1">
                      <span className="font-semibold">The best choice:</span> {f.best}. {f.bestOutcome}
                    </p>
                  )}
                </div>
              );
            })()}
            {item.format === "QUIZ" && (result.feedback as { explanation?: string | null }).explanation && <p className="mt-1 text-sm text-brand-ink">{(result.feedback as { explanation?: string | null }).explanation}</p>}
          </div>
          {mode === "play" && result.tooFast && (
            <p className="rounded-xl bg-brand-goldLight/50 px-4 py-2 text-sm text-brand-ink">That was quick. Answers under {result.minSeconds} seconds earn no XP. Slow down and read each part.</p>
          )}
          {mode === "play" && result.xp && result.xp.earned > 0 && (
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
              <Badge variant="gold">+{result.xp.earned} XP</Badge>
              {(result.xp.streak ?? 0) > 0 && <Badge variant="success">+{result.xp.streak} streak bonus</Badge>}
              {(result.xp.objective ?? 0) > 0 && <Badge variant="gold">+{result.xp.objective} objective mastered</Badge>}
              {(result.xp.module ?? 0) > 0 && <Badge variant="gold">+{result.xp.module} module completed</Badge>}
              <span className="text-xs font-normal text-gray-600">{Math.min(result.xp.today, result.xp.dailyCap)} of {result.xp.dailyCap} today</span>
            </p>
          )}
          {mode === "play" && result.objectiveJustMastered && (
            <p className="rounded-2xl bg-brand-goldLight px-4 py-3 text-sm font-semibold text-brand-goldText">
              You mastered this objective.{result.moduleCompleted ? " That completes every objective in this module." : ""}
            </p>
          )}
          {mode === "play" && result.mastery && (
            <div>
              <p className="flex items-center justify-between text-xs text-gray-700">
                <span>This objective: {({ NOT_STARTED: "Not started", LEARNING: "Learning", NEARLY_THERE: "Nearly there", MASTERED: "Mastered", NEEDS_REFRESH: "Needs refresh" } as Record<string, string>)[result.mastery.state] ?? result.mastery.state}</span>
                <span>{result.mastery.distinctCorrect} different ones right</span>
              </p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-gray/60" role="progressbar" aria-label="Progress toward mastering this objective" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(result.mastery.progress * 100)}>
                <div className="h-full rounded-full bg-brand-action transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.round(result.mastery.progress * 100)}%` }} />
              </div>
              {result.mastery.needs.length > 0 && <p className="mt-1 text-xs text-gray-600">Still needed: {result.mastery.needs.join("; ")}.</p>}
            </div>
          )}
          {mode === "play" && result.xp && result.xp.earned === 0 && result.correct && !result.tooFast && (
            <p className="text-xs text-gray-600">{result.xp.cappedByDailyLimit ? "You've reached today's XP goal." : "No XP this time: this one already earned XP today."}</p>
          )}
          {mode === "preview" && <p className="text-xs text-gray-600">Preview only: nothing is recorded and no XP is paid.</p>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={next} className="gx-pulse min-h-[48px] px-7 text-base font-extrabold">{hooks?.nextLabel ?? (mode === "preview" ? "Next item" : "Next one")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

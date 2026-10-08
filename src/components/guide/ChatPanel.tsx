"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname as useCurrentPath, useRouter } from "next/navigation";
import { ArrowRight, Eye, MapPin, Minus, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import Icon from "@/components/ui/Icon";
import LoopFace, { type LoopState } from "@/components/guide/LoopFace";
import type { GuideClientConfig } from "@/components/guide/useGuideConfig";
import { answerQuestion, buildIndex, suggest } from "@/lib/guide/match";
import type { MeKind, PageContext, QuickAction } from "@/lib/guide/context";
import { entriesForAudience } from "@/lib/guide/playbooks";
import PlaybookCard, { Marked } from "@/components/guide/PlaybookCard";
import type { GuideAction, GuideLink } from "@/lib/guide/types";
import { classifyIntent } from "@/lib/guide/intent";
import { deniedReply, resolveDestination } from "@/lib/guide/navigation";
import { showSpot } from "@/lib/guide/interactionStore";
import type { UnansweredReason } from "@/lib/guide/record";
import { getSidebarTourGuideContent, getTourGuideContent } from "@/lib/tourGuideContent";
import { pageHasSidebar } from "@/lib/sidebarRoutes";

interface Msg {
  id: string;
  from: "loop" | "me";
  text: string;
  links?: GuideLink[];
  related?: string[];
  playbookId?: string;
  /** "Take me there" and "Show me" buttons. */
  actions?: GuideAction[];
  /** What was asked and which answer was used, so "Not helpful" can tell the team. */
  asked?: string;
  matched?: string;
  entryDbId?: string;
  lowConfidence?: boolean;
  feedback?: "yes" | "no";
}

const STORE = "loop-chat-v1";
const MAX_MESSAGES = 30;

function readStored(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as Msg[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_MESSAGES) : [];
  } catch {
    return [];
  }
}

const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
const prefersLessMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function sendJson(url: string, body: unknown) {
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

const pathOnly = (href: string) => href.split("#")[0].split("?")[0] || "/";

/**
 * Loop's chat window. It answers from the written answers in the browser
 * (no AI service, no waiting on a server), offers similar questions as you
 * type, and gives every answer as text plus real links. Anything it cannot
 * answer is reported, scrubbed, so the team can write the answer once. It
 * sits above Loop's button on a computer and fills the width of a phone.
 * It is not modal: the page behind stays usable.
 */
export default function ChatPanel({
  pathname,
  config,
  me,
  ctx,
  onClose,
  onState,
}: {
  pathname: string;
  config: GuideClientConfig;
  me: MeKind | null;
  ctx: PageContext;
  onClose: () => void;
  onState: (s: LoopState) => void;
}) {
  const router = useRouter();
  const here = useCurrentPath() ?? pathname;
  const index = useMemo(() => buildIndex(entriesForAudience(config.entries, me), config.skills), [config, me]);
  const [messages, setMessages] = useState<Msg[]>(() => readStored());
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Greet once, when there is no conversation yet.
  useEffect(() => {
    setMessages((m) => (m.length ? m : [{ id: "greeting", from: "loop", text: ctx.greeting }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      /* private mode: the conversation just does not survive a reload */
    }
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, thinking]);

  useEffect(() => {
    // A phone's keyboard would cover the answer: only focus the box on a computer.
    if (isNarrow()) panelRef.current?.focus();
    else inputRef.current?.focus();
    onState("speaking");
    later(() => onState("minimized"), 1500);
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typed = input.trim();
  const suggestions = useMemo(() => {
    if (typed.length < 2) return [];
    return suggest(typed, index, 4).filter((q) => q.toLowerCase() !== typed.toLowerCase());
  }, [typed, index]);

  const push = (m: Omit<Msg, "id">) => setMessages((list) => [...list, { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }].slice(-MAX_MESSAGES));

  function report(question: string, reason: UnansweredReason, extra: { confidence?: number; attempted?: string } = {}) {
    const turns = messages.filter((m) => m.from === "me").map((m) => m.text).slice(-4, -1);
    sendJson("/api/guide/unanswered", { question, reason, route: here, page: typeof document !== "undefined" ? document.title : undefined, context: turns, ...extra });
  }

  type Reply = Omit<Msg, "id"> & { after?: () => void };

  function reply(fn: () => Reply) {
    setThinking(true);
    onState("thinking");
    later(() => {
      const { after, ...msg } = fn();
      push(msg);
      setThinking(false);
      onState("speaking");
      later(() => onState("minimized"), 1800);
      after?.();
    }, prefersLessMotion() ? 0 : 450);
  }

  /** Go to a page, the way a link would, and let the chat get out of the way on a phone. */
  function go(a: GuideAction) {
    sendJson("/api/guide/event", { type: "navigation" });
    onNavigate();
    router.push(a.href);
  }

  /** Go to the page if needed, then light up the control. */
  function show(a: GuideAction) {
    if (!a.target) return go(a);
    sendJson("/api/guide/event", { type: "navigation" });
    showSpot({ target: a.target, text: "Here it is." });
    onNavigate();
    // The chat would sit on top of what is being pointed at: tuck it away (the conversation is kept).
    onClose();
    if (pathOnly(a.href) !== pathOnly(here)) router.push(a.href);
  }

  function ask(question: string) {
    const q = question.trim().slice(0, 200);
    if (!q || thinking) return;
    push({ from: "me", text: q });
    setInput("");
    reply(() => {
      const { intent, subject } = classifyIntent(q);

      // Where is it / open it / show me it: a named place first, checked against this account.
      if (intent === "navigate" || intent === "action" || intent === "demo") {
        const res = resolveDestination(subject, me, config.switches);
        if (res.kind === "found") {
          const d = res.dest;
          const go1: GuideAction = { kind: "go", label: intent === "action" ? `Take me to ${d.label}` : `Open ${d.label}`, href: d.href };
          const show1: GuideAction = { kind: "show", label: "Show me", href: d.href, target: d.target };
          if (intent === "action") return { from: "loop", text: `Sure. I'll take you to ${d.label}.`, actions: [go1], after: () => later(() => go(go1), 900) };
          if (intent === "demo") return { from: "loop", text: `I'll show you where ${d.label} is.`, actions: [go1], after: () => later(() => show(show1), 500) };
          return { from: "loop", text: `${d.label} is here.`, actions: [go1, show1] };
        }
        if (res.kind === "denied") {
          const r = deniedReply(res.dest, res.owner, me);
          return { from: "loop", text: r.text, links: r.links };
        }
      }

      const r = answerQuestion(q, index, config.switches, me);
      const answered = r.kind !== "fallback";
      if (answered) sendJson("/api/guide/event", { type: "answered", entryId: r.entryDbId });
      return {
        from: "loop",
        text: r.lowConfidence && answered ? `${r.text}\n\nIs this what you were asking about? If not, tell me a little more.` : r.text,
        links: r.links,
        related: r.related,
        playbookId: r.playbookId,
        actions: r.actions,
        asked: q,
        matched: r.matchedQuestion,
        entryDbId: r.entryDbId,
        lowConfidence: r.lowConfidence,
        after: () => {
          if (r.kind === "fallback" && q.length >= 3) report(q, "NO_MATCH", { confidence: r.confidence, attempted: r.attempted });
          else if (r.lowConfidence && q.length >= 3) report(q, "LOW_CONFIDENCE", { confidence: r.confidence, attempted: r.attempted });
        },
      };
    });
  }

  function rate(m: Msg, answer: "yes" | "no") {
    setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, feedback: answer } : x)));
    if (answer === "yes") sendJson("/api/guide/event", { type: "helpful" });
    else if (m.asked) report(m.asked, "NOT_HELPFUL", { attempted: m.matched });
  }

  function explainPage() {
    if (thinking) return;
    push({ from: "me", text: "What can I do on this page?" });
    reply(() => {
      const entry = pageHasSidebar(pathname) ? getSidebarTourGuideContent(pathname) : getTourGuideContent(pathname);
      return { from: "loop", text: [entry.title, ...entry.notes.map((n) => `• ${n}`)].join("\n") };
    });
  }

  function onNavigate() {
    onState("helpful");
    later(() => onState("minimized"), 1600);
    if (isNarrow()) later(onClose, 150);
  }

  function runQuick(a: QuickAction) {
    if (a.ask) ask(a.ask);
    else if (a.page) explainPage();
  }

  const showQuick = messages.length <= 1;

  return (
    <div
      ref={panelRef}
      id="loop-panel"
      role="dialog"
      aria-label="Loop, the ecosystem guide"
      aria-modal="false"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
      className="fixed inset-x-3 bottom-[calc(0.75rem_+_var(--layer-banner,0px)_+_var(--layer-nav,0px))] z-50 flex h-[min(36rem,calc(100dvh_-_6rem))] flex-col overflow-hidden rounded-2xl border border-brand-gray bg-brand-surface shadow-2xl focus:outline-none animate-[modal-in_0.15s_ease-out] print:hidden sm:inset-x-auto sm:right-6 sm:bottom-[calc(6.25rem_+_var(--layer-banner,0px)_+_var(--layer-nav,0px)_+_var(--layer-fab,0px))] sm:w-[23rem]"
    >
      <header className="flex items-center gap-3 border-b border-brand-gray px-4 py-3">
        <LoopFace size={40} state={thinking ? "thinking" : "idle"} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-semibold leading-tight text-brand-ink">Loop</p>
          <p className="text-xs text-gray-600">Your guide to the ecosystem</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([{ id: "greeting", from: "loop", text: ctx.greeting }]);
            try {
              sessionStorage.removeItem(STORE);
            } catch {
              /* nothing to clear */
            }
          }}
          className="rounded px-2 py-1 text-xs font-semibold text-gray-600 hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
        >
          Start over
        </button>
        <button type="button" onClick={onClose} aria-label="Minimize Loop" className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-brand-mint hover:text-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
          <Icon icon={Minus} size="md" />
        </button>
      </header>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation with Loop" tabIndex={0} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal">
        {messages.map((m) => (
          <div key={m.id} className={m.from === "me" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === "me" ? "bg-brand-teal text-brand-onAccent" : "bg-brand-sand text-brand-ink"}`}>
              <p className="whitespace-pre-line">
                <Marked text={m.text} />
              </p>
              {m.playbookId && <PlaybookCard id={m.playbookId} onNavigate={onNavigate} onAsk={ask} onShow={onClose} />}
              {m.actions && m.actions.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {m.actions.map((a) => (
                    <li key={a.kind + a.href + a.label}>
                      <button
                        type="button"
                        onClick={() => (a.kind === "show" ? show(a) : go(a))}
                        className={`inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 ${a.kind === "go" ? "bg-brand-teal text-brand-onAccent hover:bg-brand-tealDeep" : "border border-brand-teal bg-brand-surface text-brand-teal hover:bg-brand-mint"}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon icon={a.kind === "go" ? MapPin : Eye} size="sm" /> {a.label}
                        </span>
                        <Icon icon={ArrowRight} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {m.links && m.links.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {m.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} onClick={onNavigate} className="inline-flex min-h-[40px] w-full items-center justify-between gap-2 rounded-lg border border-brand-teal bg-brand-surface px-3 text-sm font-semibold text-brand-teal hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                        {l.label} <Icon icon={ArrowRight} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {m.asked && m.matched && !m.playbookId && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs text-gray-600" role="group" aria-label="Was this helpful?">
                  {m.feedback ? (
                    <span>{m.feedback === "yes" ? "Thanks for letting me know." : "Thanks. I've passed your question to the team."}</span>
                  ) : (
                    <>
                      <span>Helpful?</span>
                      <button type="button" onClick={() => rate(m, "yes")} aria-label="Yes, this helped" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                        <Icon icon={ThumbsUp} size="sm" />
                      </button>
                      <button type="button" onClick={() => rate(m, "no")} aria-label="No, this did not help" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                        <Icon icon={ThumbsDown} size="sm" />
                      </button>
                    </>
                  )}
                </div>
              )}
              {m.related && m.related.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs text-gray-600">Did you mean:</p>
                  <ul className="mt-1 space-y-1">
                    {m.related.map((q) => (
                      <li key={q}>
                        <button type="button" onClick={() => ask(q)} className="text-left text-sm font-semibold text-brand-teal underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                          {q}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start" role="status">
            <span className="sr-only">Loop is thinking</span>
            <span aria-hidden="true" className="flex gap-1 rounded-2xl bg-brand-sand px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-2 w-2 animate-[glow-pulse_1s_ease-in-out_infinite] rounded-full bg-gray-500" style={{ animationDelay: `${i * 0.18}s` }} />
              ))}
            </span>
          </div>
        )}
        {showQuick && !thinking && (
          <div>
            <p className="text-xs font-semibold text-gray-600">Try one of these</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {ctx.quick.map((a) => (
                <li key={a.label}>
                  {a.href ? (
                    <Link href={a.href} onClick={onNavigate} className="inline-flex min-h-[40px] items-center rounded-full border border-brand-gray bg-brand-surface px-3 text-sm font-semibold text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                      {a.label}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => runQuick(a)} className="inline-flex min-h-[40px] items-center rounded-full border border-brand-gray bg-brand-surface px-3 text-sm font-semibold text-brand-ink hover:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                      {a.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-brand-gray px-4 pb-3 pt-2">
        {suggestions.length > 0 && (
          <ul aria-label="Similar questions" className="mb-2 space-y-1">
            {suggestions.map((q) => (
              <li key={q}>
                <button type="button" onClick={() => ask(q)} className="w-full rounded-lg bg-brand-sand px-3 py-2 text-left text-sm text-brand-ink hover:bg-brand-mint focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal">
                  {q}
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex gap-2"
        >
          <label htmlFor="loop-input" className="sr-only">
            Ask Loop
          </label>
          <input
            id="loop-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="Ask about training, jobs, joining…"
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink placeholder:text-gray-500 focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
          />
          <button type="submit" disabled={!typed || thinking} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-teal text-brand-onAccent hover:bg-brand-tealDeep focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-brand-gray disabled:text-gray-500">
            <Icon icon={Send} size="md" />
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-600">
          Loop answers from written answers and can&apos;t help with exam or assignment questions.
          {me ? "" : " You don't need an account to ask."}
        </p>
      </div>
    </div>
  );
}

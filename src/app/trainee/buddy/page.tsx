"use client";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface KeyStat {
  label: string;
  value: string;
}
interface ChatMessage {
  id: string;
  role: "trainee" | "loop";
  text: string;
  keyStats?: KeyStat[];
}

const SUGGESTIONS = ["Where am I in my courses?", "How am I doing so far?", "What should I do next?"];

const NAV = [
  { label: "Dashboard", href: "/trainee/dashboard" },
  { label: "Courses", href: "/trainee/courses" },
  { label: "My Downloads", href: "/trainee/downloads" },
  { label: "Introductions", href: "/trainee/introductions" },
  { label: "Job Board", href: "/trainee/job-postings" },
  { label: "Ask Loop", href: "/trainee/buddy" },
  { label: "My Profile", href: "/trainee/profile" },
  { label: "Settings", href: "/trainee/settings" },
];

/**
 * /trainee/buddy — Loop's trainee-facing persona, the Learning Buddy.
 * Same brand and chat pattern as the staff Command Center
 * (src/app/admin/command/page.tsx), simplified for this persona: no
 * proposal cards (nothing here is ever proposed for someone else to
 * confirm — every turn is just a grounded answer about the trainee's
 * own progress) and no history sidebar for v1.
 *
 * Gated on the trainee's own `aiStudyBuddyEnabled` setting (already a
 * real toggle on /trainee/settings) — shown as a calm "turn this on
 * in Settings" prompt rather than a dead end when it's off.
 */
export default function LearningBuddyPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/trainee/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setEnabled(typeof data.aiStudyBuddyEnabled === "boolean" ? data.aiStudyBuddyEnabled : false))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, asking]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || asking) return;
    setInput("");
    setAsking(true);
    setMessages((prev) => [...prev, { id: `t-${Date.now()}`, role: "trainee", text: q }]);

    const res = await fetch("/api/trainee/loop/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    setAsking(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = typeof data.error === "string" ? data.error : "Loop couldn't answer that. Please try again.";
      showToast(message, "error");
      setMessages((prev) => [...prev, { id: `l-${Date.now()}`, role: "loop", text: message }]);
      return;
    }

    const data = await res.json();
    setMessages((prev) => [...prev, { id: `l-${Date.now()}`, role: "loop", text: data.answer, keyStats: data.keyStats }]);
  }

  function newQuery() {
    setMessages([]);
    setInput("");
  }

  if (enabled === false) {
    return (
      <>
        <SiteHeader nav={NAV} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Ask Loop</p>
            <p className="mt-2 text-sm text-gray-600">
              Loop, your AI learning buddy, is turned off. Turn on "AI Study Buddy" in{" "}
              <a href="/trainee/settings" className="font-semibold text-brand-teal hover:underline">
                Settings
              </a>{" "}
              to start chatting — it can tell you about your own progress, performance, and achievements, grounded
              only in your real learning data.
            </p>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Ask Loop</h1>
            <p className="mt-1 text-sm text-gray-500">
              Your own AI learning buddy — grounded only in your real progress, never a guess.
            </p>
          </div>
          <Badge variant="success">Loop</Badge>
        </div>

        <Card className="mt-6 flex flex-col overflow-hidden p-0" style={{ minHeight: "60vh" }}>
          <div ref={threadRef} className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-gray-500">Ask Loop a question to get started.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-brand-gray px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-brand-teal hover:text-brand-teal"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "trainee" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[70%] rounded-2xl rounded-br-sm bg-brand-teal px-4 py-2.5 text-sm font-medium text-white">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[86%] space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-brand-tealDeep">Loop</p>
                    {m.keyStats && m.keyStats.length > 0 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {m.keyStats.map((s, i) => (
                          <div key={i} className="rounded-lg border border-brand-gray bg-brand-sand/50 px-3 py-2">
                            <p className="font-display text-lg font-semibold text-brand-ink">{s.value}</p>
                            <p className="text-[11px] text-gray-500">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.text && <p className="whitespace-pre-line text-sm leading-relaxed text-brand-ink">{m.text}</p>}
                  </div>
                </div>
              )
            )}

            {asking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 py-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-brand-gray p-4">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask Loop about your progress, performance, or achievements…"
                className="flex-1 rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal"
              />
              <Button onClick={() => send()} disabled={asking || !input.trim()}>
                Ask Loop
              </Button>
            </div>
            {messages.length > 0 && (
              <button onClick={newQuery} className="mt-2 text-xs font-semibold text-gray-500 hover:text-brand-teal">
                + New conversation
              </button>
            )}
          </div>
        </Card>
      </main>
    </>
  );
}

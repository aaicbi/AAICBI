"use client";
import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export interface PitchDraft {
  startupName?: string;
  industry?: string;
  problem?: string;
  solution?: string;
  targetMarket?: string;
  businessModel?: string;
  stage?: string;
  traction?: string;
  teamDescription?: string;
  fundingType?: string;
  fundingAmountKobo?: number;
  fundingPurpose?: string;
}

interface ChatMessage {
  id: string;
  role: "trainee" | "loop";
  text: string;
}

const SUGGESTIONS = ["Is my problem statement clear?", "What am I missing?", "How can I make my solution stand out?"];

/**
 * Pitch & Post's embedded Loop widget — used verbatim on both
 * /trainee/pitch/new and /trainee/pitch/[id]/edit, hence a real shared
 * component rather than duplicated page code (unlike /trainee/buddy's
 * full-page chat, which has no reason to be shared with anything).
 * Reads the current form state from its parent on every question sent,
 * so feedback is always grounded in exactly what's on screen right now
 * — even before the pitch has been saved as a draft.
 */
export default function PitchLoopPanel({ draft }: { draft: PitchDraft }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
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

    const res = await fetch("/api/trainee/loop/pitch-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, draft }),
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
    setMessages((prev) => [...prev, { id: `l-${Date.now()}`, role: "loop", text: data.answer }]);
  }

  if (enabled === false) {
    return (
      <div className="mt-4 rounded-xl border border-brand-gray p-4 text-sm text-gray-600">
        Loop's pitch coaching is turned off. Turn on "AI Study Buddy" in{" "}
        <a href="/trainee/settings" className="font-semibold text-brand-teal hover:underline">
          Settings
        </a>{" "}
        to get feedback while you write.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-xl border border-brand-gray px-4 py-3 text-left text-sm font-semibold text-brand-teal hover:border-brand-teal"
      >
        💬 Ask Loop about your pitch
      </button>
    );
  }

  return (
    <div className="mt-4 flex flex-col overflow-hidden rounded-xl border border-brand-gray">
      <div className="flex items-center justify-between border-b border-brand-gray px-4 py-2.5">
        <p className="text-sm font-semibold text-brand-ink">💬 Ask Loop about your pitch</p>
        <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-gray-500 hover:text-brand-teal">
          Close
        </button>
      </div>

      <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "280px", minHeight: "160px" }}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <p className="text-xs text-gray-500">Ask Loop for feedback on what you've written so far.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-brand-gray px-3 py-1 text-xs font-semibold text-gray-600 hover:border-brand-teal hover:text-brand-teal"
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
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-teal px-3 py-2 text-xs font-medium text-white">{m.text}</div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start">
              <div className="max-w-[90%]">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-tealDeep">Loop</p>
                <p className="whitespace-pre-line text-xs leading-relaxed text-brand-ink">{m.text}</p>
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

      <div className="border-t border-brand-gray p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask about your pitch…"
            className="flex-1 rounded-lg border border-brand-gray px-3 py-2 text-xs outline-none focus:border-brand-teal"
          />
          <Button size="sm" onClick={() => send()} disabled={asking || !input.trim()}>
            Ask
          </Button>
        </div>
      </div>
    </div>
  );
}

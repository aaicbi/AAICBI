"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatView } from "@/lib/arena/chat";
import { EMOJI } from "./reactions";

const EMOJIS = Object.values(EMOJI);
const isEmoji = (b: string) => EMOJIS.some((x) => x.e === b);
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** The course chat: a short running conversation among the trainees enrolled in the course. */
export default function ArenaChat({ courseId, chat, suspended, onSent, flash }: { courseId: string; chat: ChatView; suspended: string | null; onSent: () => void; flash: (m: string) => void }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const last = chat.messages[chat.messages.length - 1]?.id;
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [last]);

  async function send(e: React.FormEvent, quick?: string) {
    e.preventDefault();
    const body = quick ?? text.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await fetch(`/api/arena/courses/${courseId}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
    setSending(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That message didn't send.");
    if (!quick) setText("");
    onSent();
  }

  return (
    <div className="ar-glass ar-chat">
      <strong>Course chat</strong>
      <div className="ar-chatlist" ref={list} role="log" aria-live="polite" aria-label="Course chat messages">
        {chat.messages.length === 0 && <p className="ar-muted">No messages yet. Say hello to your coursemates.</p>}
        {chat.messages.map((m) => (
          <div key={m.id} className={`ar-msg${m.mine ? " ar-mine" : ""}`}>
            {!m.mine && <div className="ar-av" aria-hidden>{m.initials}</div>}
            <div className="ar-bub">
              {!m.mine && <div className="ar-who">{m.name}</div>}
              <div className={isEmoji(m.body) ? "ar-bigmoji" : undefined}>{m.body}</div>
              <div className="ar-at">{clock(m.at)}</div>
            </div>
          </div>
        ))}
      </div>
      {suspended ? (
        <p className="ar-note ar-miss" role="status">{suspended}</p>
      ) : (
        <>
        <div className="ar-chatrx" role="group" aria-label="Reactions">
          {EMOJIS.map((x) => <button key={x.l} type="button" className="ar-chatrxb" disabled={sending} aria-label={x.l} title={x.l} onClick={(e) => void send(e, x.e)}>{x.e}</button>)}
        </div>
        <form className="ar-row" onSubmit={(e) => void send(e)}>
          <input className="ar-chatin" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Write a message" aria-label="Message" enterKeyHint="send" />
          <button type="submit" className="ar-btn ar-sm" disabled={sending || !text.trim()}>Send</button>
        </form>
        </>
      )}
    </div>
  );
}

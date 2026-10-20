"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessageView, ChatView } from "@/lib/arena/chat";
import { EMOJI } from "./reactions";
import ArenaWallet from "./ArenaWallet";

const EMOJIS = Object.values(EMOJI);
const isEmoji = (b: string) => EMOJIS.some((x) => x.e === b);
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const post = (url: string, body?: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

interface Mate { id: string; name: string; initials: string; status: "AVAILABLE" | "BUSY" }
interface Away { id: string; name: string; initials: string }

/** The course chat: the running conversation of the trainees in a course, with game challenges and Fastest Fingers questions as cards. */
export default function ArenaChat({ courseId, chat, suspended, online, offline, busy, onChanged, flash, big }: {
  courseId: string; chat: ChatView; suspended: string | null; online: Mate[]; offline: Away[]; busy: boolean; onChanged: () => void; flash: (m: string) => void; big?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const last = chat.messages[chat.messages.length - 1];
  const lastKey = last ? `${last.id}:${last.sprint?.open ?? ""}:${last.challenge?.status ?? ""}` : "";
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [lastKey]);

  async function send(e: React.FormEvent, quick?: string) {
    e.preventDefault();
    const body = quick ?? text.trim();
    if (!body || sending) return;
    setSending(true);
    const res = await post(`/api/arena/courses/${courseId}/chat`, { body });
    setSending(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That message didn't send.");
    if (!quick) setText("");
    onChanged();
  }
  async function challenge(id: string) {
    setPicking(false);
    const res = await post(`/api/arena/courses/${courseId}/challenge`, { opponentId: id, moduleId: null });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That didn't work.");
    if (j.reach && j.reach !== "online") {
      const who = [...online, ...offline].find((p) => p.id === id)?.name.split(" ")[0] ?? "They";
      flash(j.reach === "push" ? `Challenge sent. ${who} gets a notification on their phone.` : `Challenge sent. ${who} won't get a phone alert, so they'll see it next time they open the app.`);
      onChanged();
      return;
    }
    router.push(`/trainee/arena/match/${j.id}`);
  }
  async function respond(matchId: string, accept: boolean) {
    const res = await post(`/api/arena/matches/${matchId}/${accept ? "accept" : "decline"}`);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That didn't work.");
    if (accept) router.push(`/trainee/arena/match/${matchId}`); else onChanged();
  }
  async function answer(m: ChatMessageView, choice: string) {
    const res = await post(`/api/arena/courses/${courseId}/sprint/${m.sprint!.id}`, { choice });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) flash(j.error ?? "That didn't work.");
    else if (j.won) flash(`You won ${m.sprint!.points} credits!`);
    else if (j.late) flash("So close: someone was faster.");
    else if (!j.correct) flash("Not that one.");
    onChanged();
  }

  const card = (m: ChatMessageView) => {
    if (m.kind === "CHALLENGE" && m.challenge) {
      const c = m.challenge;
      const label = c.status === "PENDING" ? (c.toMe ? "wants to play you" : `Waiting for ${c.toName}…`) : c.status === "DECLINED" ? "Declined" : c.status === "EXPIRED" || c.status === "CANCELLED" ? "Expired" : c.status === "COMPLETED" || c.status === "FORFEITED" ? "Played" : "Accepted";
      const live = c.status === "LOBBY" || c.status === "ACTIVE";
      return (
        <div className="ar-card ar-cchallenge">
          <div className="ar-crown">⚔️ Challenge</div>
          <p className="ar-name">{c.fromName} → {c.toName}{c.topic ? ` · ${c.topic}` : ""} <span className="ar-sub">· {label}</span></p>
          {c.status === "PENDING" && c.toMe && <div className="ar-row"><button type="button" className="ar-btn ar-sm" onClick={() => void respond(c.matchId, true)}>Accept</button><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => void respond(c.matchId, false)}>Decline</button></div>}
          {live && (c.toMe || c.fromMe) && <button type="button" className="ar-btn ar-sm" onClick={() => router.push(`/trainee/arena/match/${c.matchId}`)}>Join match</button>}
        </div>
      );
    }
    if (m.kind === "FASTEST" && m.sprint) {
      const s = m.sprint;
      const done = !!s.mine || !s.open;
      return (
        <div className="ar-card ar-cfast">
          <div className="ar-crown">⚡ Fastest Fingers · {s.points} credits</div>
          <p className="ar-name">{s.question}</p>
          <div className="ar-fopts ar-fgrid">
            {s.options.map((o) => {
              const right = s.correctKey === o.key;
              const picked = s.mine?.choice === o.key;
              return (
                <button key={o.key} type="button" disabled={done || !!suspended} onClick={() => void answer(m, o.key)} className={`ar-fopt${right ? " ar-fright" : picked ? " ar-fwrong" : ""}`}><b>{o.key}</b> {o.text}</button>
              );
            })}
          </div>
          {s.open && s.mine && <p className="ar-sub">{s.mine.correct ? "Your answer is in." : "That wasn't it. One try each."} Waiting for the result…</p>}
          {!s.open && <p className="ar-sub">{s.winnerName ? `🏆 ${s.winnerName} was first.` : "Closed with no winner."}{s.explanation ? ` ${s.explanation}` : ""}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`ar-glass ar-chat${big ? " ar-chatbig" : ""}${picking ? " ar-withpeople" : ""}`}>
      <div className="ar-row"><strong className="ar-grow">Course chat</strong>{chat.fastest || chat.credits > 0 ? (chat.wallet ? <button type="button" className="ar-pill" title="Your credits: open your wallet" aria-expanded={walletOpen} onClick={() => setWalletOpen((o) => !o)} style={{ cursor: "pointer", color: "inherit" }}>⭐ {chat.credits}</button> : <span className="ar-pill" title="Your credit scores">⭐ {chat.credits}</span>) : null}{!suspended && <button type="button" className="ar-btn ar-ghost ar-sm" disabled={busy} onClick={() => setPicking((p) => !p)} aria-expanded={picking}>⚔️ Challenge</button>}</div>
      {walletOpen && chat.wallet && <ArenaWallet courseId={courseId} onClose={() => setWalletOpen(false)} onChanged={onChanged} flash={flash} />}
      {picking && (
        <>
        <div className="ar-pickslot" aria-hidden />
        <div className="ar-chatpick" role="menu" aria-label="People in this course" data-testid="people-panel">
          <div className="ar-pickhead"><strong className="ar-grow">Challenge someone</strong><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => setPicking(false)} aria-label="Close the list of people">✕</button></div>
          {online.length === 0 && <p className="ar-muted">Nobody else is online right now.</p>}
          {online.map((p) => <button key={p.id} type="button" role="menuitem" className="ar-pickrow" disabled={p.status === "BUSY"} onClick={() => void challenge(p.id)}><span className="ar-av" aria-hidden>{p.initials}</span><span className="ar-grow">{p.name}</span>{p.status === "BUSY" && <span className="ar-sub">In a match</span>}</button>)}
          {offline.length > 0 && <p className="ar-sub" style={{ margin: ".3em .3em 0" }}>Not online · they get a notification on their phone</p>}
          {offline.map((p) => <button key={p.id} type="button" role="menuitem" className="ar-pickrow" onClick={() => void challenge(p.id)}><span className="ar-av" aria-hidden>{p.initials}</span><span className="ar-grow">{p.name}</span></button>)}
        </div>
        </>
      )}
      <div className="ar-chatlist" ref={list} role="log" aria-live="polite" aria-label="Course chat messages">
        {chat.messages.length === 0 && <p className="ar-muted">No messages yet. Say hello to your coursemates.</p>}
        {chat.messages.map((m) => (m.kind === "SYSTEM" ? (
          <div key={m.id} className="ar-sysmsg">{m.body}</div>
        ) : m.kind === "TEXT" ? (
          <div key={m.id} className={`ar-msg${m.mine ? " ar-mine" : ""}`}>
            {!m.mine && <div className="ar-av" aria-hidden>{m.initials}</div>}
            <div className="ar-bub">
              {!m.mine && <div className="ar-who">{m.name}</div>}
              <div className={isEmoji(m.body) ? "ar-bigmoji" : undefined}>{m.body}</div>
              <div className="ar-at">{clock(m.at)}</div>
            </div>
          </div>
        ) : <div key={m.id} className="ar-cardrow">{card(m)}</div>))}
      </div>
      {suspended ? (
        <p className="ar-note ar-miss" role="status">{suspended}</p>
      ) : (
        <>
          <div className={`ar-chatrx${rxOpen ? " ar-open" : ""}`} role="group" aria-label="Reactions">
            {EMOJIS.map((x) => <button key={x.l} type="button" className="ar-chatrxb" disabled={sending} aria-label={x.l} title={x.l} onClick={(e) => { setRxOpen(false); void send(e, x.e); }}>{x.e}</button>)}
          </div>
          <form className="ar-row" onSubmit={(e) => void send(e)}>
            <button type="button" className="ar-emojibtn" aria-expanded={rxOpen} aria-label="Reactions" onClick={() => setRxOpen((o) => !o)}>😀</button>
            <input className="ar-chatin" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Write a message" aria-label="Message" enterKeyHint="send" />
            <button type="submit" className="ar-btn ar-sm" disabled={sending || !text.trim()}>Send</button>
          </form>
        </>
      )}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatSummary, ChatView, ChatMessageView } from "@/lib/arena/chat";

export interface ConversationRow { id: string; type: "DIRECT" | "COHORT"; title: string; subtitle?: string | null; lastMessage?: { body: string; createdAt: string } | null; unreadCount: number }
interface Contact { type: "TRAINEE" | "STAFF" | "EMPLOYER"; id: string; name: string }
type View = { k: "list" } | { k: "group"; courseId: string; title: string } | { k: "dm"; id: string; title: string } | { k: "new" };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const when = (t: string | number | null | undefined) => {
  if (!t) return "";
  const d = new Date(t); const now = new Date();
  return d.toDateString() === now.toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const post = (url: string, body?: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

/** The Messages button's inbox: course group chats, then direct conversations with instructors, admins and coursemates. */
export default function MessagesPanel({ conversations, chats, reload, onClose, toast }: {
  conversations: ConversationRow[]; chats: ChatSummary[]; reload: () => void; onClose: () => void; toast: (m: string, kind?: "success" | "error") => void;
}) {
  const [view, setView] = useState<View>({ k: "list" });
  const back = () => { setView({ k: "list" }); reload(); };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {view.k === "list" && <Inbox conversations={conversations} chats={chats} open={setView} onNew={() => setView({ k: "new" })} />}
      {view.k === "group" && <GroupThread courseId={view.courseId} title={view.title} back={back} toast={toast} />}
      {view.k === "dm" && <DirectThread id={view.id} title={view.title} back={back} toast={toast} />}
      {view.k === "new" && <NewMessage back={back} opened={(id, title) => setView({ k: "dm", id, title })} toast={toast} />}
      <span className="sr-only" onClick={onClose} />
    </div>
  );
}

function Row({ icon, title, tag, sub, at, unread, onClick, group }: { icon: string; title: string; tag?: string; sub?: string | null; at?: string; unread?: number; onClick: () => void; group?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-brand-mint/60">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center text-sm font-bold ${group ? "rounded-xl bg-[#F2B84B] text-lg text-[#2A1D00]" : "rounded-full bg-brand-mint text-brand-teal"}`} aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5"><b className="truncate text-sm text-brand-ink">{title}</b>{tag && <span className="shrink-0 rounded-full bg-brand-mint px-1.5 py-0.5 text-[10px] font-bold text-brand-teal">{tag}</span>}</span>
        <span className="block truncate text-xs text-gray-500">{sub || "No messages yet"}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-gray-500">{at}{!!unread && <i className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-rose px-1 text-[11px] font-bold not-italic text-brand-onAccent">{unread}</i>}</span>
    </button>
  );
}

function Inbox({ conversations, chats, open, onNew }: { conversations: ConversationRow[]; chats: ChatSummary[]; open: (v: View) => void; onNew: () => void }) {
  const cohorts = conversations.filter((c) => c.type === "COHORT");
  const direct = conversations.filter((c) => c.type === "DIRECT");
  const empty = chats.length + cohorts.length + direct.length === 0;
  return (
    <>
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Inbox</span>
        <button type="button" onClick={onNew} className="rounded-full bg-brand-mint px-3 py-1 text-xs font-bold text-brand-teal">＋ New message</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2" data-testid="messages-inbox">
        {empty && <p className="px-3 py-6 text-center text-sm text-gray-500">No conversations yet. Start one with ＋ New message.</p>}
        {chats.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">Course group chats</p>}
        {chats.map((c) => <Row key={c.courseId} group icon="💬" title={c.title} sub={c.preview} at={when(c.at)} unread={c.unread} onClick={() => open({ k: "group", courseId: c.courseId, title: c.title })} />)}
        {cohorts.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">Cohort chats</p>}
        {cohorts.map((c) => <Row key={c.id} group icon="👥" title={c.title} sub={c.lastMessage?.body ?? c.subtitle} at={when(c.lastMessage?.createdAt)} unread={c.unreadCount} onClick={() => open({ k: "dm", id: c.id, title: c.title })} />)}
        {direct.length > 0 && <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">Direct messages</p>}
        {direct.map((c) => <Row key={c.id} icon={initials(c.title)} title={c.title} sub={c.lastMessage?.body} at={when(c.lastMessage?.createdAt)} unread={c.unreadCount} onClick={() => open({ k: "dm", id: c.id, title: c.title })} />)}
      </div>
    </>
  );
}

function Header({ title, back, extra }: { title: string; back: () => void; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-brand-gray px-3 py-2">
      <button type="button" onClick={back} aria-label="Back to the inbox" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-mint font-bold text-brand-teal">←</button>
      <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-brand-ink">{title}</h3>
      {extra}
    </div>
  );
}

function Composer({ placeholder, onSend, disabled }: { placeholder: string; onSend: (t: string) => Promise<boolean>; disabled?: string | null }) {
  const [t, setT] = useState("");
  const [busy, setBusy] = useState(false);
  if (disabled) return <p className="border-t border-brand-gray px-3 py-2 text-xs text-brand-rose">{disabled}</p>;
  return (
    <form className="flex gap-2 border-t border-brand-gray p-2.5" onSubmit={async (e) => { e.preventDefault(); const body = t.trim(); if (!body || busy) return; setBusy(true); const ok = await onSend(body); setBusy(false); if (ok) setT(""); }}>
      <input value={t} onChange={(e) => setT(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={500} className="min-w-0 flex-1 rounded-full border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" />
      <button type="submit" disabled={busy || !t.trim()} className="rounded-full bg-[#F2B84B] px-4 text-sm font-bold text-[#2A1D00] disabled:opacity-60">Send</button>
    </form>
  );
}

function usePoll(fn: () => void | Promise<void>, ms: number) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { void ref.current(); const id = setInterval(() => { if (!document.hidden) void ref.current(); }, ms); return () => clearInterval(id); }, [ms]);
}

function GroupThread({ courseId, title, back, toast }: { courseId: string; title: string; back: () => void; toast: (m: string, k?: "success" | "error") => void }) {
  const router = useRouter();
  const [data, setData] = useState<{ chat: ChatView; suspended: string | null } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/arena/courses/${courseId}/chat/thread`, { cache: "no-store" });
    if (r.ok) { setData(await r.json()); void post(`/api/arena/courses/${courseId}/chat/read`); }
  }, [courseId]);
  usePoll(load, 3000);
  const last = data?.chat.messages[data.chat.messages.length - 1];
  const key = last ? `${last.id}:${last.sprint?.open ?? ""}:${last.challenge?.status ?? ""}` : "";
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [key]);

  async function answer(m: ChatMessageView, choice: string) {
    const r = await post(`/api/arena/courses/${courseId}/sprint/${m.sprint!.id}`, { choice });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) toast(j.error ?? "That didn't work.", "error"); else if (j.won) toast(`You won ${m.sprint!.points} credits!`, "success"); else if (j.late) toast("So close: someone was faster."); else if (!j.correct) toast("Not that one.");
    void load();
  }
  async function respond(matchId: string, accept: boolean) {
    const r = await post(`/api/arena/matches/${matchId}/${accept ? "accept" : "decline"}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error ?? "That didn't work.", "error");
    if (accept) router.push(`/trainee/arena/match/${matchId}`); else void load();
  }

  return (
    <>
      <Header title={title} back={back} extra={<a href={`/trainee/arena/${courseId}/chat`} className="shrink-0 rounded-full bg-brand-mint px-2.5 py-1 text-xs font-bold text-brand-teal">Full chat ↗</a>} />
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2" role="log" aria-live="polite" aria-label={`${title} messages`}>
        {!data && <p className="py-6 text-center text-sm text-gray-500">Opening the chat…</p>}
        {data && !data.chat.enabled && <p className="py-6 text-center text-sm text-gray-500">The course chat isn't open right now.</p>}
        {data?.chat.messages.map((m) => {
          if (m.kind === "SYSTEM") return <p key={m.id} className="text-center text-xs font-bold text-brand-teal">{m.body}</p>;
          if (m.kind === "CHALLENGE" && m.challenge) {
            const c = m.challenge;
            const live = c.status === "LOBBY" || c.status === "ACTIVE";
            return (
              <div key={m.id} className="rounded-xl border border-brand-gray bg-brand-mint/40 p-2.5 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">⚔️ Challenge</p>
                <p className="font-semibold text-brand-ink">{c.fromName} → {c.toName}{c.topic ? ` · ${c.topic}` : ""}</p>
                <p className="text-xs text-gray-600">{c.status === "PENDING" ? (c.toMe ? "wants to play you" : "Waiting…") : c.status === "DECLINED" ? "Declined" : live ? "Accepted" : "Over"}</p>
                {c.status === "PENDING" && c.toMe && <div className="mt-1.5 flex gap-2"><button type="button" onClick={() => void respond(c.matchId, true)} className="rounded-full bg-[#F2B84B] px-3 py-1 text-xs font-bold text-[#2A1D00]">Accept</button><button type="button" onClick={() => void respond(c.matchId, false)} className="rounded-full border border-brand-gray px-3 py-1 text-xs font-bold text-brand-ink">Decline</button></div>}
                {live && (c.toMe || c.fromMe) && <button type="button" onClick={() => router.push(`/trainee/arena/match/${c.matchId}`)} className="mt-1.5 rounded-full bg-[#F2B84B] px-3 py-1 text-xs font-bold text-[#2A1D00]">Join match</button>}
              </div>
            );
          }
          if (m.kind === "FASTEST" && m.sprint) {
            const s = m.sprint; const done = !!s.mine || !s.open;
            return (
              <div key={m.id} className="rounded-xl border border-[#F2B84B] bg-brand-surface p-2.5 text-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-teal">⚡ Fastest Fingers · {s.points} credits</p>
                <p className="font-semibold text-brand-ink">{s.question}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {s.options.map((o) => {
                    const right = s.correctKey === o.key; const picked = s.mine?.choice === o.key;
                    return <button key={o.key} type="button" disabled={done || !!data.suspended} onClick={() => void answer(m, o.key)} className={`rounded-lg border px-2 py-1.5 text-left text-xs font-semibold ${right ? "border-green-500 bg-green-100 text-green-900" : picked ? "border-brand-rose bg-red-50 text-red-900" : "border-brand-gray bg-brand-surface text-brand-ink"}`}><b>{o.key}</b> {o.text}</button>;
                  })}
                </div>
                <p className="mt-1 text-xs text-gray-600">{s.open ? (s.mine ? "Your answer is in." : "One try each. First right answer wins.") : s.winnerName ? `🏆 ${s.winnerName} was first.` : "Closed with no winner."}</p>
              </div>
            );
          }
          return (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${m.mine ? "self-end bg-brand-action text-brand-onAccent" : "self-start bg-brand-mint/60 text-brand-ink"}`}>
              {!m.mine && <span className="block text-[10.5px] font-bold text-brand-teal">{m.name}</span>}
              <span style={{ overflowWrap: "anywhere" }}>{m.body}</span>
              <span className="block text-right text-[10px] opacity-70">{when(m.at)}</span>
            </div>
          );
        })}
      </div>
      <Composer placeholder="Message the group" disabled={data?.suspended ?? null} onSend={async (body) => {
        const r = await post(`/api/arena/courses/${courseId}/chat`, { body });
        if (!r.ok) { toast((await r.json().catch(() => ({}))).error ?? "That message didn't send.", "error"); return false; }
        void load(); return true;
      }} />
    </>
  );
}

interface DmMessage { id: string; authorType: string; authorId: string; authorName?: string; body: string; createdAt: string }

function DirectThread({ id, title, back, toast }: { id: string; title: string; back: () => void; toast: (m: string, k?: "success" | "error") => void }) {
  const [d, setD] = useState<{ messages: DmMessage[]; viewer: { actorType: string; actorId: string; isMessagingSuspended?: boolean }; conversationType: string } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { const r = await fetch(`/api/conversations/${id}/messages?limit=100`, { cache: "no-store" }); if (r.ok) setD(await r.json()); }, [id]);
  usePoll(load, 4000);
  const n = d?.messages.length ?? 0;
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [n]);
  return (
    <>
      <Header title={title} back={back} />
      <div ref={list} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2" role="log" aria-live="polite" aria-label={`${title} messages`}>
        {!d && <p className="py-6 text-center text-sm text-gray-500">Opening the conversation…</p>}
        {d && d.messages.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No messages yet. Say hello.</p>}
        {d?.messages.map((m) => {
          const mine = m.authorType === d.viewer.actorType && m.authorId === d.viewer.actorId;
          return (
            <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm ${mine ? "self-end bg-brand-action text-brand-onAccent" : "self-start bg-brand-mint/60 text-brand-ink"}`}>
              {!mine && d.conversationType === "COHORT" && <span className="block text-[10.5px] font-bold text-brand-teal">{m.authorName}</span>}
              <span style={{ overflowWrap: "anywhere" }}>{m.body}</span>
              <span className="block text-right text-[10px] opacity-70">{when(m.createdAt)}</span>
            </div>
          );
        })}
      </div>
      <Composer placeholder={`Message ${title}`} disabled={d?.viewer.isMessagingSuspended ? "Your messaging access has been suspended. You can still read your conversations." : null} onSend={async (body) => {
        const r = await post(`/api/conversations/${id}/messages`, { body });
        if (!r.ok) { toast((await r.json().catch(() => ({}))).error ?? "That message didn't send.", "error"); return false; }
        void load(); return true;
      }} />
    </>
  );
}

function NewMessage({ back, opened, toast }: { back: () => void; opened: (id: string, title: string) => void; toast: (m: string, k?: "success" | "error") => void }) {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/conversations/contacts").then((r) => (r.ok ? r.json() : [])).then(setContacts).catch(() => setContacts([])); }, []);
  async function start(c: Contact) {
    const r = await post("/api/conversations/direct", { peerType: c.type, peerId: c.id });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toast(j.error ?? "You can't message this person.", "error");
    opened(j.id, c.name);
  }
  const f = (contacts ?? []).filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const staff = f.filter((c) => c.type === "STAFF"); const mates = f.filter((c) => c.type === "TRAINEE"); const emps = f.filter((c) => c.type === "EMPLOYER");
  const section = (label: string, rows: Contact[], tag?: string) => rows.length > 0 && (
    <div key={label}><p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-wider text-gray-500">{label}</p>{rows.map((c) => <Row key={`${c.type}:${c.id}`} icon={initials(c.name)} title={c.name} tag={tag} onClick={() => void start(c)} sub={c.type === "STAFF" ? "Message directly" : undefined} />)}</div>
  );
  return (
    <>
      <Header title="New message" back={back} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people in your courses" aria-label="Search people" className="mx-3 mt-2 rounded-xl border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" />
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {!contacts && <p className="px-3 py-6 text-center text-sm text-gray-500">Loading people…</p>}
        {contacts && f.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-500">No one found.</p>}
        {section("Instructors and admins", staff, "Staff")}
        {section("Coursemates", mates)}
        {section("Employers", emps)}
      </div>
    </>
  );
}

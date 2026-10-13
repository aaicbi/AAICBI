"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Loader2, Menu, MoreHorizontal, Paperclip, Pencil, Plus, Square, Trash2, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import GuideSwitchCard from "@/components/admin/GuideSwitchCard";
import Markdown from "@/components/command/Markdown";
import ActionCardView, { type ActionCardData } from "@/components/command/ActionCardView";
import LevelPicker from "@/components/command/LevelPicker";
import { clampLevel, type LoopLevel } from "@/lib/loop/policy";

interface ConversationItem {
  id: string;
  title: string;
  level: number;
  updatedAt: string;
}
interface UiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: { name: string; kind: string }[];
  tools: { id?: string; label: string; state: "running" | "done" }[];
  actions: ActionCardData[];
  streaming?: boolean;
  error?: string;
}

const SUGGESTIONS = [
  { title: "Platform overview", prompt: "Give me an overview of the platform right now: trainees, courses, employers and anything that needs attention." },
  { title: "Set up a module", prompt: "Help me set up learning objectives for a module. Ask me which module, read its materials, and draft them." },
  { title: "Who needs attention?", prompt: "Which trainees or cohorts look at risk this week, and what would you suggest I do about each?" },
  { title: "Write an announcement", prompt: "Help me write a clear, warm announcement to our trainees. Ask me what it is about." },
];

const ACCEPT = ".pdf,.docx,.doc,.pptx,.xlsx,.txt,.md,.csv,.json,image/png,image/jpeg,image/webp,image/gif";

function groupLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1 && new Date().getDate() === d.getDate()) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 8) return "Previous 7 days";
  return "Older";
}

/** Reads server-sent events from a fetch response. */
async function* readEvents(res: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) {
        try {
          yield JSON.parse(line.slice(6));
        } catch {
          // ignore a malformed chunk
        }
      }
    }
  }
}

export default function CommandCenter() {
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [level, setLevel] = useState<LoopLevel>(1);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/loop/conversations");
    if (!res.ok) return setConversations([]);
    const data = await res.json();
    setConversations(data.conversations);
    return data as { conversations: ConversationItem[]; defaultLevel: number };
  }, []);

  useEffect(() => {
    void loadList().then((d) => d && setLevel(clampLevel(d.defaultLevel)));
  }, [loadList]);

  // Keep the newest text in view unless the person scrolled up to read.
  useEffect(() => {
    const el = threadRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Grow the box with what is typed.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  function onScroll() {
    const el = threadRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  async function openConversation(id: string) {
    setDrawer(false);
    setMenuFor(null);
    if (streaming) return;
    const res = await fetch(`/api/admin/loop/conversations/${id}`);
    if (!res.ok) return showToast("Could not open that chat.", "error");
    const data = await res.json();
    setActiveId(id);
    setLevel(clampLevel(data.level));
    stickRef.current = true;
    setMessages(
      data.messages.map((m: { id: string; role: "user" | "assistant"; text: string; attachments: { name: string; kind: string }[] | null; toolEvents: { tool: string; label: string }[] | null; actions: ActionCardData[] }) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        attachments: m.attachments ?? undefined,
        tools: (m.toolEvents ?? []).map((t) => ({ label: t.label, state: "done" as const })),
        actions: m.actions,
      }))
    );
  }

  function newChat() {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setFiles([]);
    setInput("");
    setDrawer(false);
    textRef.current?.focus();
  }

  const patch = (id: string, fn: (m: UiMessage) => UiMessage) => setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));

  async function send(override?: string) {
    const text = (override ?? input).trim();
    if ((!text && files.length === 0) || streaming) return;
    const sending = files;
    setInput("");
    setFiles([]);
    setStreaming(true);
    stickRef.current = true;
    const userId = `u-${Date.now()}`;
    const replyId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", text, attachments: sending.map((f) => ({ name: f.name, kind: "file" })), tools: [], actions: [] },
      { id: replyId, role: "assistant", text: "", tools: [], actions: [], streaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const form = new FormData();
      form.set("message", text);
      form.set("level", String(level));
      if (activeId) form.set("conversationId", activeId);
      for (const f of sending) form.append("files", f);
      const res = await fetch("/api/admin/loop/chat", { method: "POST", body: form, signal: controller.signal });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        const message = typeof data.error === "string" ? data.error : "Loop couldn't answer that. Please try again.";
        patch(replyId, (m) => ({ ...m, streaming: false, error: message }));
        return;
      }
      for await (const ev of readEvents(res)) {
        if (ev.type === "meta") {
          setActiveId(String(ev.conversationId));
        } else if (ev.type === "text") {
          patch(replyId, (m) => ({ ...m, text: m.text + String(ev.delta) }));
        } else if (ev.type === "tool") {
          patch(replyId, (m) => {
            const id = String(ev.id);
            const exists = m.tools.some((t) => t.id === id);
            const tools = exists
              ? m.tools.map((t) => (t.id === id ? { ...t, state: ev.state as "running" | "done" } : t))
              : [...m.tools, { id, label: String(ev.label), state: ev.state as "running" | "done" }];
            return { ...m, tools };
          });
        } else if (ev.type === "action") {
          const card = ev.card as ActionCardData;
          patch(replyId, (m) => ({ ...m, actions: m.actions.some((a) => a.id === card.id) ? m.actions.map((a) => (a.id === card.id ? card : a)) : [...m.actions, card] }));
        } else if (ev.type === "error") {
          patch(replyId, (m) => ({ ...m, error: String(ev.message) }));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") patch(replyId, (m) => ({ ...m, error: "The connection was interrupted. Please try again." }));
    } finally {
      patch(replyId, (m) => ({ ...m, streaming: false }));
      setStreaming(false);
      abortRef.current = null;
      void loadList();
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function decide(actionId: string, decision: "approve" | "reject") {
    setBusyAction(actionId);
    const res = await fetch(`/api/admin/loop/actions/${actionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    setBusyAction(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return showToast(typeof data.error === "string" ? data.error : "That didn't work. Please try again.", "error");
    setMessages((prev) => prev.map((m) => ({ ...m, actions: m.actions.map((a) => (a.id === actionId ? (data as ActionCardData) : a)) })));
    if (data.status === "EXECUTED") showToast("Done.", "success");
  }

  async function changeLevel(l: LoopLevel) {
    setLevel(l);
    if (activeId) {
      await fetch(`/api/admin/loop/conversations/${activeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ level: l }) });
    }
  }

  async function saveRename() {
    if (!renaming) return;
    const title = renaming.title.trim();
    setRenaming(null);
    if (!title) return;
    const res = await fetch(`/api/admin/loop/conversations/${renaming.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (res.ok) void loadList();
  }

  async function remove(id: string) {
    setMenuFor(null);
    const ok = await confirm({ title: "Delete this chat?", description: "The conversation is removed for good. Changes Loop already made stay made.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/admin/loop/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return showToast("Could not delete that chat.", "error");
    if (activeId === id) newChat();
    void loadList();
  }

  function addFiles(list: FileList | File[]) {
    const next = [...files, ...Array.from(list)].slice(0, 5);
    setFiles(next);
  }

  const grouped: [string, ConversationItem[]][] = [];
  for (const c of conversations ?? []) {
    const label = groupLabel(c.updatedAt);
    const g = grouped.find(([l]) => l === label);
    if (g) g[1].push(c);
    else grouped.push([label, [c]]);
  }

  const sidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-3">
        <button
          type="button"
          onClick={newChat}
          data-testid="new-chat"
          className="flex min-h-[44px] w-full items-center gap-2 rounded-full border border-brand-gray bg-brand-surface px-4 text-sm font-semibold text-brand-ink hover:border-brand-teal"
        >
          <Icon icon={Plus} size="sm" /> New chat
        </button>
      </div>
      <nav aria-label="Your chats" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {conversations === null && <p className="px-3 py-2 text-xs text-gray-500">Loading…</p>}
        {conversations && conversations.length === 0 && <p className="px-3 py-2 text-xs text-gray-500">Your chats will appear here.</p>}
        {grouped.map(([label, items]) => (
          <div key={label} className="mb-3">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
            <ul>
              {items.map((c) => (
                <li key={c.id} className="group relative">
                  {renaming?.id === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveRename();
                      }}
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      <input
                        autoFocus
                        aria-label="Chat name"
                        value={renaming.title}
                        onChange={(e) => setRenaming({ id: c.id, title: e.target.value })}
                        onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                        className="min-w-0 flex-1 rounded-lg border border-brand-teal bg-brand-surface px-2 py-1.5 text-sm text-brand-ink outline-none"
                      />
                      <button type="submit" aria-label="Save name" className="rounded-full p-1.5 text-brand-teal hover:bg-brand-mint">
                        <Icon icon={Check} size="sm" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => openConversation(c.id)}
                        aria-current={c.id === activeId ? "page" : undefined}
                        className={`block w-full truncate rounded-xl px-3 py-2.5 pr-10 text-left text-sm ${c.id === activeId ? "bg-brand-mint font-semibold text-brand-ink" : "text-gray-700 hover:bg-brand-gray/30"}`}
                      >
                        {c.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Options for ${c.title}`}
                        aria-expanded={menuFor === c.id}
                        onClick={() => setMenuFor(menuFor === c.id ? null : c.id)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-500 hover:bg-brand-gray/50 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Icon icon={MoreHorizontal} size="sm" />
                      </button>
                      {menuFor === c.id && (
                        <div className="absolute right-1 top-full z-20 mt-1 w-40 rounded-xl border border-brand-gray bg-brand-surface p-1 shadow-lg">
                          <button type="button" onClick={() => { setRenaming({ id: c.id, title: c.title }); setMenuFor(null); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-ink hover:bg-brand-gray/30">
                            <Icon icon={Pencil} size="sm" /> Rename
                          </button>
                          <button type="button" onClick={() => remove(c.id)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-rose hover:bg-brand-roseLight/50">
                            <Icon icon={Trash2} size="sm" /> Delete
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <details className="border-t border-brand-gray p-3 text-sm">
        <summary className="cursor-pointer select-none font-semibold text-gray-700">Loop settings</summary>
        <div className="mt-3">
          <GuideSwitchCard />
        </div>
      </details>
    </div>
  );

  const empty = messages.length === 0;

  return (
    <div
      className="relative flex h-[calc(100dvh-4.5rem)] min-h-[520px] overflow-hidden rounded-none border-brand-gray bg-brand-sand sm:rounded-2xl sm:border"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {modal}
      <aside className="hidden w-72 shrink-0 border-r border-brand-gray bg-brand-surface md:block">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Your chats">
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col bg-brand-surface shadow-xl">
            <div className="flex items-center justify-between px-3 pt-3">
              <p className="px-1 text-sm font-semibold text-brand-ink">Your chats</p>
              <button type="button" aria-label="Close chats" onClick={() => setDrawer(false)} className="rounded-full p-2 text-brand-ink hover:bg-brand-gray/40">
                <Icon icon={X} size="md" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{sidebar}</div>
          </div>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
        <div className="flex items-center gap-2 border-b border-brand-gray px-3 py-2 md:hidden">
          <button type="button" aria-label="Open chats" onClick={() => setDrawer(true)} className="rounded-full p-2 text-brand-ink hover:bg-brand-gray/40">
            <Icon icon={Menu} size="md" />
          </button>
          <p className="truncate text-sm font-semibold text-brand-ink">{conversations?.find((c) => c.id === activeId)?.title ?? "New chat"}</p>
          <button type="button" aria-label="New chat" onClick={newChat} className="ml-auto rounded-full p-2 text-brand-ink hover:bg-brand-gray/40">
            <Icon icon={Plus} size="md" />
          </button>
        </div>

        <div ref={threadRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Messages" className="min-h-0 flex-1 overflow-y-auto" data-testid="thread">
          {empty ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-5 py-8 text-center">
              <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-action text-xl font-bold text-brand-onAccent">L</span>
              <h1 className="mt-4 font-display text-2xl font-semibold text-brand-ink sm:text-3xl">How can I help today?</h1>
              <p className="mt-2 max-w-md text-sm text-gray-600">Ask about anything on the platform, attach a document, or tell me what to set up. You decide how much I do on my own with the level beside the send button.</p>
              <div className="mt-6 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.title}
                    type="button"
                    data-testid="suggestion"
                    onClick={() => void send(s.prompt)}
                    className="rounded-2xl border border-brand-gray bg-brand-surface p-4 text-left hover:border-brand-teal"
                  >
                    <span className="block text-sm font-semibold text-brand-ink">{s.title}</span>
                    <span className="mt-1 block text-xs text-gray-600">{s.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <li key={m.id} className="flex justify-end" data-testid="user-message">
                    <div className="max-w-[85%] rounded-3xl bg-brand-mint px-4 py-2.5 text-[0.95rem] text-brand-ink">
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                          {m.attachments.map((a, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-brand-surface/70 px-2.5 py-1 text-xs font-medium">
                              <Icon icon={Paperclip} size="sm" /> {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.text}</p>
                    </div>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-3" data-testid="assistant-message">
                    <span aria-hidden className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-action text-xs font-bold text-brand-onAccent">L</span>
                    <div className="min-w-0 flex-1">
                      {m.tools.length > 0 && (
                        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="What Loop looked at">
                          {m.tools.map((t, i) => (
                            <li key={t.id ?? i} className="inline-flex items-center gap-1.5 rounded-full border border-brand-gray bg-brand-surface px-2.5 py-1 text-xs text-gray-600">
                              {t.state === "running" ? <Icon icon={Loader2} size="sm" className="animate-spin motion-reduce:animate-none" /> : <Icon icon={Check} size="sm" className="text-brand-teal" />}
                              {t.label}
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.text ? <Markdown text={m.text} /> : m.streaming && m.tools.length === 0 ? <p className="text-sm text-gray-500">Thinking…</p> : null}
                      {m.streaming && m.text && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand-teal align-middle motion-reduce:animate-none" aria-hidden />}
                      {m.actions.map((a) => (
                        <ActionCardView key={a.id} card={a} busy={busyAction === a.id} onDecide={decide} />
                      ))}
                      {m.error && (
                        <p role="alert" className="mt-2 rounded-xl bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">
                          {m.error}
                        </p>
                      )}
                    </div>
                  </li>
                )
              )}
            </ol>
          )}
        </div>

        <div className="border-t border-transparent px-3 pb-3 sm:px-4 sm:pb-4">
          <div className={`mx-auto max-w-3xl rounded-3xl border bg-brand-surface p-2 shadow-sm ${dragging ? "border-brand-teal ring-2 ring-brand-teal/30" : "border-brand-gray"}`}>
            {files.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 px-2 pb-1 pt-1" aria-label="Attached files">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-gray/40 py-1 pl-2.5 pr-1 text-xs font-medium text-brand-ink">
                    <Icon icon={Paperclip} size="sm" />
                    <span className="truncate">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded-full p-1 hover:bg-brand-gray/60">
                      <Icon icon={X} size="sm" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label htmlFor="loop-input" className="sr-only">
              Message Loop
            </label>
            <textarea
              id="loop-input"
              ref={textRef}
              value={input}
              rows={1}
              placeholder="Message Loop…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files);
                if (pasted.length) {
                  e.preventDefault();
                  addFiles(pasted);
                }
              }}
              className="block max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-base text-brand-ink outline-none placeholder:text-gray-500"
            />
            <div className="flex items-center gap-1 px-1 pt-1">
              <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" data-testid="file-input" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" aria-label="Attach files" onClick={() => fileRef.current?.click()} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 hover:bg-brand-gray/40">
                <Icon icon={Paperclip} size="md" />
              </button>
              <div className="ml-auto flex items-center gap-1">
                <LevelPicker level={level} onChange={changeLevel} disabled={streaming} />
                {streaming ? (
                  <button type="button" aria-label="Stop" data-testid="stop" onClick={stop} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-action text-brand-onAccent hover:bg-brand-actionHover">
                    <Icon icon={Square} size="sm" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label="Send"
                    data-testid="send"
                    disabled={!input.trim() && files.length === 0}
                    onClick={() => void send()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-action text-brand-onAccent hover:bg-brand-actionHover disabled:bg-brand-gray disabled:text-gray-500"
                  >
                    <Icon icon={ArrowUp} size="md" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="mx-auto mt-2 max-w-3xl px-2 text-center text-[11px] text-gray-500">Loop can make mistakes. Check important details, and review anything it proposes before approving.</p>
        </div>
      </section>
    </div>
  );
}

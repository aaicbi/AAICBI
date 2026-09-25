"use client";
import { useEffect, useRef, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface KeyStat {
  label: string;
  value: string;
}
interface BroadcastResult {
  sentCount: number;
  failedCount: number;
  recipientCountActual: number;
  countChanged: boolean;
}
interface Proposal {
  recipientDescription: string;
  recipientFilter: unknown;
  recipientCount: number;
  truncated: boolean;
  subject: string;
  body: string;
  category: string;
  state: "pending" | "sending" | "sent" | "cancelled" | "failed";
  result?: BroadcastResult;
  errorMessage?: string;
}
interface ObjectivesProposal {
  moduleId: string;
  moduleDescription: string;
  objectives: string[];
  state: "pending" | "sending" | "sent" | "cancelled" | "failed";
  errorMessage?: string;
}
interface SuspensionProposal {
  traineeId: string;
  traineeName: string;
  reason: string;
  state: "pending" | "sending" | "sent" | "cancelled" | "failed";
  errorMessage?: string;
}
interface ChatMessage {
  id: string;
  role: "admin" | "loop";
  text: string;
  keyStats?: KeyStat[];
  proposal?: Proposal;
  objectivesProposal?: ObjectivesProposal;
  suspensionProposal?: SuspensionProposal;
}
interface HistoryItem {
  id: string;
  question: string;
  askedByName: string;
  createdAt: string;
}

const SUGGESTIONS = [
  "Give me a platform overview",
  "List all cohorts",
  "Which employers are pending approval?",
];

/**
 * /admin/command — the AI Command Center, SUPER_ADMIN only. A real
 * chat surface over src/lib/loop/tools.ts's read-only tools: Loop can
 * look up a trainee, employer, staff member, or cohort and report on
 * it, but has no path anywhere in this codebase to change anything —
 * see that file's own comment and the ask route's for the actual
 * safety boundary (there is no write tool to call, not just an
 * instruction asking it not to).
 *
 * Deliberately simpler than the earlier design exploration: real
 * answers come back as Loop's own free-form prose (plus up to four
 * headline stat tiles it chooses to surface), not the mockup's
 * hand-scripted per-entity report cards — an honest answer generated
 * from real tool calls this conversation, not a fixed template.
 */
export default function CommandCenterPage() {
  const [role, setRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRole(typeof data.role === "string" ? data.role : null))
      .catch(() => setRole(null))
      .finally(() => setRoleChecked(true));
  }, []);

  function loadHistory() {
    fetch("/api/admin/loop/history")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setHistory)
      .catch(() => setHistory([]));
  }

  useEffect(() => {
    if (role === "SUPER_ADMIN") loadHistory();
  }, [role]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, asking]);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || asking) return;
    setInput("");
    setAsking(true);
    setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "admin", text: q }]);

    const res = await fetch("/api/admin/loop/ask", {
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
    if (data.kind === "messageProposal") {
      setMessages((prev) => [
        ...prev,
        { id: `l-${Date.now()}`, role: "loop", text: "", proposal: { ...data.proposal, state: "pending" } },
      ]);
    } else if (data.kind === "objectivesProposal") {
      setMessages((prev) => [
        ...prev,
        { id: `l-${Date.now()}`, role: "loop", text: "", objectivesProposal: { ...data.proposal, state: "pending" } },
      ]);
    } else if (data.kind === "suspensionProposal") {
      setMessages((prev) => [
        ...prev,
        { id: `l-${Date.now()}`, role: "loop", text: "", suspensionProposal: { ...data.proposal, state: "pending" } },
      ]);
    } else {
      setMessages((prev) => [...prev, { id: `l-${Date.now()}`, role: "loop", text: data.answer, keyStats: data.keyStats }]);
    }
    loadHistory();
  }

  function newQuery() {
    setMessages([]);
    setInput("");
  }

  function cancelProposal(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, state: "cancelled" } } : m))
    );
  }

  async function sendProposal(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, state: "sending" } } : m))
    );

    const target = messages.find((m) => m.id === messageId)?.proposal;
    if (!target) return;

    const res = await fetch("/api/admin/messages/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientFilter: target.recipientFilter,
        recipientDescription: target.recipientDescription,
        recipientCountExpected: target.recipientCount,
        subject: target.subject,
        body: target.body,
        category: target.category,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = typeof data.error === "string" ? data.error : "Loop couldn't send that message. Please try again.";
      showToast(message, "error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, state: "failed", errorMessage: message } } : m
        )
      );
      return;
    }

    const result: BroadcastResult = await res.json();
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId && m.proposal ? { ...m, proposal: { ...m.proposal, state: "sent", result } } : m))
    );
  }

  function cancelObjectives(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.objectivesProposal
          ? { ...m, objectivesProposal: { ...m.objectivesProposal, state: "cancelled" } }
          : m
      )
    );
  }

  async function confirmObjectives(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.objectivesProposal
          ? { ...m, objectivesProposal: { ...m.objectivesProposal, state: "sending" } }
          : m
      )
    );

    const target = messages.find((m) => m.id === messageId)?.objectivesProposal;
    if (!target) return;

    const res = await fetch("/api/admin/loop/objectives/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId: target.moduleId, objectives: target.objectives }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = typeof data.error === "string" ? data.error : "Couldn't save these objectives. Please try again.";
      showToast(message, "error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.objectivesProposal
            ? { ...m, objectivesProposal: { ...m.objectivesProposal, state: "failed", errorMessage: message } }
            : m
        )
      );
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.objectivesProposal ? { ...m, objectivesProposal: { ...m.objectivesProposal, state: "sent" } } : m
      )
    );
    showToast("Objectives saved.", "success");
  }

  function cancelSuspension(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.suspensionProposal ? { ...m, suspensionProposal: { ...m.suspensionProposal, state: "cancelled" } } : m
      )
    );
  }

  async function confirmSuspension(messageId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.suspensionProposal ? { ...m, suspensionProposal: { ...m.suspensionProposal, state: "sending" } } : m
      )
    );

    const target = messages.find((m) => m.id === messageId)?.suspensionProposal;
    if (!target) return;

    const res = await fetch(`/api/admin/trainees/${target.traineeId}/messaging-suspension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SUSPEND", reason: target.reason }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message = typeof data.error === "string" ? data.error : "Couldn't suspend this trainee. Please try again.";
      showToast(message, "error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId && m.suspensionProposal
            ? { ...m, suspensionProposal: { ...m.suspensionProposal, state: "failed", errorMessage: message } }
            : m
        )
      );
      return;
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.suspensionProposal ? { ...m, suspensionProposal: { ...m.suspensionProposal, state: "sent" } } : m
      )
    );
    showToast("Messaging access suspended.", "success");
  }

  const nav = [
    { label: "Examinations", href: "/admin/dashboard" },
    { label: "Courses", href: "/admin/courses" },
    { label: "Command", href: "/admin/command" },
    { label: "Settings", href: "/admin/settings" },
  ];

  if (roleChecked && role !== "SUPER_ADMIN") {
    return (
      <>
        <SiteHeader nav={nav} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Command</p>
            <p className="mt-2 text-sm text-gray-600">
              Only Super Admins can use the AI Command Center. If you need something looked up, ask a Super Admin on
              your team.
            </p>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={nav} right={<LogoutButton />} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-brand-ink">Command</h1>
            <p className="mt-1 text-sm text-gray-500">
              Ask Loop about any trainee, employer, staff member, or cohort — it can only look things up and report
              back, never change anything on its own — or, with your explicit confirmation, send a message on the
              platform's behalf.
            </p>
          </div>
          <Badge variant="success">Loop</Badge>
        </div>

        <div className="mt-6 flex gap-5" style={{ minHeight: "60vh" }}>
          <aside className="hidden w-64 shrink-0 flex-col gap-3 md:flex">
            <button
              onClick={newQuery}
              className="rounded-lg border border-dashed border-brand-gray px-3 py-2.5 text-sm font-semibold text-brand-teal hover:border-brand-teal hover:bg-brand-mint/40"
            >
              + New query
            </button>
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">History</p>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {history === null && <p className="px-2 text-xs text-gray-400">Loading…</p>}
              {history?.length === 0 && <p className="px-2 text-xs text-gray-400">No questions asked yet.</p>}
              {history?.map((h) => (
                <button
                  key={h.id}
                  onClick={() => send(h.question)}
                  className="rounded-lg px-2.5 py-2 text-left hover:bg-brand-mint/30"
                >
                  <p className="line-clamp-2 text-xs font-semibold text-brand-ink">{h.question}</p>
                  <p className="mt-0.5 text-[11px] text-gray-400">{new Date(h.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          </aside>

          <Card className="flex flex-1 flex-col overflow-hidden p-0">
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
                m.role === "admin" ? (
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

                      {m.proposal && (
                        <Card className="w-full max-w-md space-y-3 border-brand-teal/40 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="success">Message proposal</Badge>
                            <span className="text-xs font-semibold text-gray-500">
                              {m.proposal.recipientCount} recipient{m.proposal.recipientCount === 1 ? "" : "s"}
                              {m.proposal.truncated && " (capped)"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">To: {m.proposal.recipientDescription}</p>
                          <div className="rounded-lg border border-brand-gray bg-brand-sand/40 p-3">
                            <p className="text-sm font-semibold text-brand-ink">{m.proposal.subject}</p>
                            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{m.proposal.body}</p>
                          </div>

                          {m.proposal.state === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => cancelProposal(m.id)}>
                                Cancel
                              </Button>
                              <Button onClick={() => sendProposal(m.id)}>Send</Button>
                            </div>
                          )}
                          {m.proposal.state === "sending" && <p className="text-xs font-semibold text-gray-500">Sending…</p>}
                          {m.proposal.state === "cancelled" && (
                            <p className="text-xs font-semibold text-gray-500">Cancelled — nothing was sent.</p>
                          )}
                          {m.proposal.state === "sent" && m.proposal.result && (
                            <p className="text-xs font-semibold text-brand-tealDeep">
                              Sent to {m.proposal.result.sentCount} of {m.proposal.result.recipientCountActual}
                              {m.proposal.result.failedCount > 0 && ` — ${m.proposal.result.failedCount} failed`}
                              {m.proposal.result.countChanged &&
                                ` (recipient list changed since you confirmed — was ${m.proposal.recipientCount})`}
                              .
                            </p>
                          )}
                          {m.proposal.state === "failed" && (
                            <p className="text-xs font-semibold text-red-600">{m.proposal.errorMessage ?? "Send failed."}</p>
                          )}
                        </Card>
                      )}

                      {m.objectivesProposal && (
                        <Card className="w-full max-w-md space-y-3 border-brand-teal/40 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="success">Learning objectives</Badge>
                            <span className="text-xs font-semibold text-gray-500">
                              {m.objectivesProposal.objectives.length} objective
                              {m.objectivesProposal.objectives.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">For: {m.objectivesProposal.moduleDescription}</p>
                          <ol className="list-decimal space-y-1.5 rounded-lg border border-brand-gray bg-brand-sand/40 p-3 pl-7 text-sm text-gray-700">
                            {m.objectivesProposal.objectives.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ol>

                          {m.objectivesProposal.state === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => cancelObjectives(m.id)}>
                                Cancel
                              </Button>
                              <Button onClick={() => confirmObjectives(m.id)}>Save objectives</Button>
                            </div>
                          )}
                          {m.objectivesProposal.state === "sending" && (
                            <p className="text-xs font-semibold text-gray-500">Saving…</p>
                          )}
                          {m.objectivesProposal.state === "cancelled" && (
                            <p className="text-xs font-semibold text-gray-500">Cancelled — nothing was saved.</p>
                          )}
                          {m.objectivesProposal.state === "sent" && (
                            <p className="text-xs font-semibold text-brand-tealDeep">Saved to the module.</p>
                          )}
                          {m.objectivesProposal.state === "failed" && (
                            <p className="text-xs font-semibold text-red-600">{m.objectivesProposal.errorMessage ?? "Save failed."}</p>
                          )}
                        </Card>
                      )}

                      {m.suspensionProposal && (
                        <Card className="w-full max-w-md space-y-3 border-brand-rose/40 bg-white">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="danger">Suspend messaging</Badge>
                          </div>
                          <p className="text-xs text-gray-500">Trainee: {m.suspensionProposal.traineeName}</p>
                          <div className="rounded-lg border border-brand-gray bg-brand-sand/40 p-3">
                            <p className="text-sm text-gray-700">{m.suspensionProposal.reason}</p>
                          </div>

                          {m.suspensionProposal.state === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" onClick={() => cancelSuspension(m.id)}>
                                Cancel
                              </Button>
                              <Button variant="danger" onClick={() => confirmSuspension(m.id)}>
                                Suspend
                              </Button>
                            </div>
                          )}
                          {m.suspensionProposal.state === "sending" && <p className="text-xs font-semibold text-gray-500">Suspending…</p>}
                          {m.suspensionProposal.state === "cancelled" && (
                            <p className="text-xs font-semibold text-gray-500">Cancelled — nothing was changed.</p>
                          )}
                          {m.suspensionProposal.state === "sent" && (
                            <p className="text-xs font-semibold text-brand-rose">Messaging access suspended.</p>
                          )}
                          {m.suspensionProposal.state === "failed" && (
                            <p className="text-xs font-semibold text-red-600">{m.suspensionProposal.errorMessage ?? "Failed."}</p>
                          )}
                        </Card>
                      )}
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
                  placeholder="Ask Loop about a trainee, employer, staff member, or cohort…"
                  className="flex-1 rounded-lg border border-brand-gray px-3 py-2.5 text-sm outline-none focus:border-brand-teal"
                />
                <Button onClick={() => send()} disabled={asking || !input.trim()}>
                  Ask Loop
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}

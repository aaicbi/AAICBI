"use client";
import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useConfirmModal } from "@/components/ui/useConfirmModal";
import { MoreVertical } from "lucide-react";
import ReportModal from "./ReportModal";
import SuspendReasonModal from "./SuspendReasonModal";

interface MessageDto {
  id: string;
  authorType: "TRAINEE" | "STAFF";
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}
interface ThreadDto {
  title: string;
  conversationType: "DIRECT" | "COHORT";
  otherParticipant: { type: "TRAINEE" | "STAFF"; id: string; name: string } | null;
  viewer: { actorType: "TRAINEE" | "STAFF"; actorId: string; isSuperAdmin: boolean; isMessagingSuspended: boolean };
  messages: MessageDto[];
}

/**
 * Shared message-list + composer, reused by both the trainee and staff
 * detail pages — same "one shared body, two thin page wrappers" split
 * PerformanceDashboard.tsx already established.
 *
 * Fetch-on-mount + a 60s poll, unlike the QA thread pages' fetch-once
 * pattern — following NotificationBell's own precedent/justification
 * for polling being this app's accepted real-time answer (no
 * WebSocket/SSE infra anywhere else in the project), since a chat view
 * that never auto-refreshes would feel broken in a way a notification
 * badge's staleness doesn't.
 */
export default function ConversationThread({ conversationId }: { conversationId: string }) {
  const [thread, setThread] = useState<ThreadDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "TRAINEE" | "STAFF"; id: string; name: string } | null>(null);
  const [suspendReasonOpen, setSuspendReasonOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const { confirm, modal } = useConfirmModal();

  function load() {
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setThread)
      .catch(() => setNotFound(true));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [thread?.messages.length]);

  async function send() {
    if (!body.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't send that message.", "error");
      return;
    }
    setBody("");
    load();
  }

  async function block() {
    if (!thread?.otherParticipant) return;
    setMenuOpen(false);
    const ok = await confirm({
      title: `Block ${thread.otherParticipant.name}?`,
      description: "They won't be able to message you, and you won't be able to message them.",
      confirmLabel: "Block",
      danger: true,
    });
    if (!ok) return;
    const res = await fetch("/api/conversations/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedType: thread.otherParticipant.type, blockedId: thread.otherParticipant.id }),
    });
    if (res.ok) showToast(`Blocked ${thread.otherParticipant.name}.`, "success");
    else showToast("Couldn't block this user. Please try again.", "error");
  }

  async function issueSuspensionAction(action: "SUSPEND" | "REINSTATE", reason: string) {
    if (!thread?.otherParticipant || thread.otherParticipant.type !== "TRAINEE") return;
    const res = await fetch(`/api/admin/trainees/${thread.otherParticipant.id}/messaging-suspension`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    if (res.ok) showToast(action === "SUSPEND" ? "Messaging access suspended." : "Messaging access reinstated.", "success");
    else showToast("That action couldn't be completed.", "error");
  }

  function startSuspend() {
    setMenuOpen(false);
    setSuspendReasonOpen(true);
  }

  async function reinstate() {
    setMenuOpen(false);
    await issueSuspensionAction("REINSTATE", "Reinstated from the conversation view.");
  }

  async function confirmSuspend(reason: string) {
    setSuspendReasonOpen(false);
    await issueSuspensionAction("SUSPEND", reason);
  }

  if (notFound) {
    return <p className="mt-6 text-center text-sm text-gray-600">Conversation not found, or you don&apos;t have access to it.</p>;
  }
  if (!thread) {
    return (
      <div className="mt-6">
        <SkeletonList rows={3} />
      </div>
    );
  }

  const suspended = thread.viewer.actorType === "TRAINEE" && thread.viewer.isMessagingSuspended;
  // A SUPER_ADMIN observing a DM neither party involves them in has
  // read-only oversight — otherParticipant comes back null specifically
  // for that case (see the messages route). Sending would 403, so the
  // composer shouldn't be offered at all rather than fail on submit.
  const canSend = thread.conversationType === "COHORT" || thread.otherParticipant !== null;
  const canBlock = thread.conversationType === "DIRECT" && thread.otherParticipant !== null;
  const canModerate = thread.viewer.isSuperAdmin && thread.conversationType === "DIRECT" && thread.otherParticipant?.type === "TRAINEE";
  const showOptionsMenu = canBlock || canModerate;

  return (
    <>
      {modal}
      {reportTarget && (
        <ReportModal
          open
          reportedType={reportTarget.type}
          reportedId={reportTarget.id}
          reportedName={reportTarget.name}
          conversationId={conversationId}
          onClose={() => setReportTarget(null)}
        />
      )}

      {thread.otherParticipant && (
        <SuspendReasonModal
          open={suspendReasonOpen}
          traineeName={thread.otherParticipant.name}
          onCancel={() => setSuspendReasonOpen(false)}
          onConfirm={confirmSuspend}
        />
      )}

      <Card className="mt-4 flex flex-col overflow-hidden p-0" style={{ minHeight: "60vh" }}>
        <div className="flex items-center justify-between border-b border-brand-gray px-4 py-3">
          <p className="font-display font-semibold text-brand-ink">{thread.title}</p>
          {showOptionsMenu && (
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} aria-label="Options" className="rounded-lg p-1.5 text-gray-400 hover:bg-brand-mint/40 hover:text-brand-ink">
              <Icon icon={MoreVertical} size="sm" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-brand-gray bg-brand-surface py-1 shadow-lg">
                {thread.conversationType === "DIRECT" && thread.otherParticipant && (
                  <button onClick={block} className="block w-full px-3 py-2 text-left text-sm text-brand-ink hover:bg-brand-mint/30">
                    Block {thread.otherParticipant.name}
                  </button>
                )}
                {thread.viewer.isSuperAdmin && thread.conversationType === "DIRECT" && thread.otherParticipant?.type === "TRAINEE" && (
                  <>
                    <div className="my-1 border-t border-brand-gray" />
                    <button onClick={startSuspend} className="block w-full px-3 py-2 text-left text-sm text-brand-rose hover:bg-brand-roseLight/60">
                      Suspend from messaging
                    </button>
                    <button onClick={reinstate} className="block w-full px-3 py-2 text-left text-sm text-brand-ink hover:bg-brand-mint/30">
                      Reinstate messaging
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {thread.messages.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No messages yet — say hello.</p>}
          {thread.messages.map((m) => {
            const isMine = m.authorType === thread.viewer.actorType && m.authorId === thread.viewer.actorId;
            return (
              <Card key={m.id} className={m.authorType === "STAFF" ? "border-brand-teal bg-brand-teal/5" : ""}>
                <p className="text-sm text-gray-800">{m.body}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {m.authorName}
                    {m.authorType === "STAFF" && <span className="ml-1 font-semibold text-brand-teal">· Staff</span>}
                    {" · "}
                    {new Date(m.createdAt).toLocaleString()}
                  </p>
                  {!isMine && (
                    <button
                      onClick={() => setReportTarget({ type: m.authorType, id: m.authorId, name: m.authorName })}
                      className="shrink-0 text-xs text-gray-400 hover:text-brand-rose"
                    >
                      Report
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="border-t border-brand-gray p-4">
          {suspended ? (
            <p className="rounded-lg bg-brand-roseLight px-3 py-2 text-sm text-brand-rose">
              Your messaging access has been suspended. You can still read your conversations.
            </p>
          ) : !canSend ? (
            <p className="text-center text-xs text-gray-500">Viewing as an observer — this conversation doesn&apos;t include you.</p>
          ) : (
            <div className="flex gap-2">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Write a message…"
                rows={2}
                className="flex-1 rounded-lg border border-brand-gray px-3 py-2 text-sm outline-none focus:border-brand-teal"
              />
              <Button onClick={send} loading={sending} disabled={!body.trim()}>
                Send
              </Button>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

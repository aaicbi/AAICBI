"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X } from "lucide-react";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

import { Input, Select, Textarea } from "@/components/ui/Field";
import { ABOVE_BANNER, FAB_FOOTPRINT_PX, setFloatingOffset } from "@/lib/floatingLayers";
interface ConversationRow {
  id: string;
  type: "DIRECT" | "COHORT";
  title: string;
  unreadCount: number;
}

const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";
const MAX_FILES = 5;

/**
 * A persistent, trainee-wide inline composer — fixed bottom-right on
 * every authenticated trainee page, mounted once in src/app/trainee/
 * layout.tsx (same "mount once, pathname decides visibility" pattern
 * as TourGuideButton.tsx). User-requested: clicking this used to
 * navigate to /trainee/messages; it now opens an anchored popover
 * (same toggle/outside-click-to-close/animate-[modal-in_...] mechanics
 * already proven in NotificationBell.tsx) with two tabs instead.
 *
 * "Message" tab reuses existing, already-trainee-callable endpoints
 * rather than inventing new backend: POST /api/messages/to-admin for
 * "Admin" (the same institutional inbox ContactAdminCard.tsx already
 * posts to — broadcasts to every SUPER_ADMIN, no single-admin picking
 * needed), and POST /api/conversations/[id]/messages for "My Cohort"
 * (the cohort Conversation rows already come back from the same
 * GET /api/conversations call this component polls for the unread
 * badge — no extra request needed to populate the target list).
 *
 * "Showcase" tab is the new moderated Community Showcase submission
 * flow: creates a Project (POST /api/trainee/projects,
 * listedInShowcase: true — defaults to PENDING_REVIEW, so it won't be
 * public until an admin approves it at /admin/showcase) then uploads
 * each selected file to it (POST .../projects/[id]/media).
 *
 * Hidden on the two live exam/assessment-taking screens — unchanged
 * from the previous version; see that logic's own reasoning below.
 */
export default function FloatingMessagesButton() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"message" | "showcase">("message");
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  // Message tab state
  const [target, setTarget] = useState<string>("ADMIN");
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  // Showcase tab state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function load() {
      fetch("/api/conversations")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((rows: ConversationRow[]) => setConversations(rows))
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = conversations.reduce((sum, row) => sum + row.unreadCount, 0);
  const cohortConversations = conversations.filter((c) => c.type === "COHORT");

  async function sendMessage() {
    if (!messageBody.trim() || sending) return;
    setSending(true);
    const res =
      target === "ADMIN"
        ? await fetch("/api/messages/to-admin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject: "Quick message", body: messageBody.trim() }),
          })
        : await fetch(`/api/conversations/${target}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: messageBody.trim() }),
          });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't send that message. Try again.", "error");
      return;
    }
    showToast("Message sent.", "success");
    setMessageBody("");
    setOpen(false);
  }

  function addFiles(selected: FileList | null) {
    if (!selected) return;
    const next = [...files, ...Array.from(selected)].slice(0, MAX_FILES);
    if (files.length + selected.length > MAX_FILES) {
      showToast(`You can attach up to ${MAX_FILES} files.`, "error");
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function submitShowcase() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);

    const createRes = await fetch("/api/trainee/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || undefined,
        url: url.trim() || undefined,
        listedInShowcase: true,
      }),
    });
    if (!createRes.ok) {
      setSubmitting(false);
      const data = await createRes.json().catch(() => ({}));
      showToast(typeof data.error === "string" ? data.error : "Couldn't submit your project. Try again.", "error");
      return;
    }
    const project = await createRes.json();

    let uploadFailures = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const mediaRes = await fetch(`/api/trainee/projects/${project.id}/media`, { method: "POST", body: formData });
      if (!mediaRes.ok) uploadFailures++;
    }

    setSubmitting(false);
    if (uploadFailures > 0) {
      showToast(`Submitted for review, but ${uploadFailures} file(s) didn't upload. Manage it from your profile.`, "error");
    } else {
      showToast("Submitted for review — an admin will take a look before it goes public.", "success");
    }
    setTitle("");
    setDescription("");
    setUrl("");
    setFiles([]);
    setOpen(false);
  }

  const isLiveExamOrAssessment = pathname?.endsWith("/examination/take") || pathname?.endsWith("/assessment/take");

  // Tell the other floating layers this button is on screen.
  useEffect(() => {
    if (isLiveExamOrAssessment) return;
    setFloatingOffset("fab", FAB_FOOTPRINT_PX);
    return () => setFloatingOffset("fab", 0);
  }, [isLiveExamOrAssessment]);

  if (isLiveExamOrAssessment) return null;

  return (
    <div ref={containerRef} className="fixed right-6 z-40" style={{ bottom: ABOVE_BANNER }}>
      {open && (
        <div className="absolute bottom-14 right-0 w-80 max-w-[90vw] rounded-xl border border-brand-gray bg-brand-surface shadow-lg animate-[modal-in_0.15s_ease-out] sm:w-96">
          <div className="flex items-center justify-between border-b border-brand-gray px-4 py-3">
            <div className="flex gap-1">
              <button
                onClick={() => setTab("message")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  tab === "message" ? "bg-brand-mint text-brand-teal" : "text-gray-500 hover:text-brand-teal"
                }`}
              >
                Message
              </button>
              <button
                onClick={() => setTab("showcase")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  tab === "showcase" ? "bg-brand-mint text-brand-teal" : "text-gray-500 hover:text-brand-teal"
                }`}
              >
                Share to Showcase
              </button>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-brand-mint hover:text-brand-teal"
            >
              <Icon icon={X} size="sm" />
            </button>
          </div>

          {tab === "message" ? (
            <div className="space-y-3 p-4">
              <Select label="Send to" compact id="composer-target" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="ADMIN">Admin</option>
                  {cohortConversations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              <Textarea label="Type your message…" hideLabel controlClassName="resize-none" value={messageBody} onChange={(e) => setMessageBody(e.target.value)} placeholder="Type your message…" rows={4} maxLength={5000} />
              <div className="flex justify-end">
                <Button size="sm" onClick={sendMessage} disabled={sending || !messageBody.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              <Input label="Project title" hideLabel compact value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" maxLength={160} />
              <Textarea label="What did you build? (optional)" hideLabel controlClassName="resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you build? (optional)" rows={3} maxLength={2000} />
              <Input label="Project link (optional)" hideLabel compact value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Project link (optional)" />
              <div>
                <input ref={fileInputRef} type="file" accept={ACCEPT} multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={files.length >= MAX_FILES}
                  className="rounded-lg border border-brand-gray px-3 py-1.5 text-xs font-semibold text-brand-ink disabled:opacity-60"
                >
                  Add photos or video
                </button>
                <p className="mt-1 text-xs text-gray-500">Up to {MAX_FILES} files — images or short video.</p>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                        <span className="truncate">{f.name}</span>
                        <button onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`} className="shrink-0 text-brand-rose hover:underline">
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-xs text-gray-500">Submitted posts are reviewed by an admin before they appear on the public Showcase.</p>
              <div className="flex justify-end">
                <Button size="sm" onClick={submitShowcase} disabled={submitting || !title.trim()}>
                  {submitting ? "Submitting…" : "Submit for review"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Messages, ${unreadCount} unread` : "Messages"}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-brand-onAccent shadow-lg transition-transform hover:scale-105 hover:bg-brand-tealDeep"
      >
        <Icon icon={open ? X : MessageSquare} size="md" />
        {!open && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-rose px-1 text-[10px] font-bold text-brand-onAccent">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}

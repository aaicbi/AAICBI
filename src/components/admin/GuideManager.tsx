"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import EntryForm from "@/components/admin/guide/EntryForm";
import QueueTab from "@/components/admin/guide/QueueTab";
import KnowledgeTab from "@/components/admin/guide/KnowledgeTab";
import { CategoriesTab, FaqTab, HistoryTab, OverviewTab, SettingsTab, TargetsTab } from "@/components/admin/guide/OtherTabs";
import { EMPTY_DRAFT, bodyOf, draftFrom, draftFromQuestion, type Draft, type EntryDto, type Payload, type QuestionDto } from "@/components/admin/guide/shared";

const TABS = [
  ["overview", "Overview"],
  ["queue", "Needs review"],
  ["faq", "Frequently asked"],
  ["knowledge", "Knowledge base"],
  ["navigation", "Navigation"],
  ["history", "Learning history"],
  ["categories", "Categories"],
  ["targets", "Pointing targets"],
  ["settings", "Settings"],
] as const;
type TabId = (typeof TABS)[number][0];

/**
 * Guide Bot Knowledge. SUPER_ADMIN only. Where questions Loop could not
 * answer are reviewed and turned into approved answers, where those answers
 * are kept (with every version), and where the numbers show what visitors
 * struggle with. Loop only ever uses answers a person wrote or approved.
 */
export default function GuideManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<TabId>("overview");
  const [feature, setFeature] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ draft: Draft; entryId?: string; question?: QuestionDto } | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const load = useCallback(() => {
    setLoadError(false);
    fetch("/api/admin/guide").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);

  const call = useCallback(
    async (url: string, method: string, payload?: unknown): Promise<boolean> => {
      setBusy(true);
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
      setBusy(false);
      if (!res.ok) {
        showToast((await res.json().catch(() => ({}))).error ?? "That did not work.", "error");
        return false;
      }
      load();
      return true;
    },
    [load, showToast],
  );

  async function save() {
    if (!editing) return;
    const payload = bodyOf(editing.draft);
    const ok = editing.question
      ? await call(`/api/admin/guide/unanswered/${editing.question.id}`, "POST", { action: "answer", ...payload })
      : editing.entryId
        ? await call(`/api/admin/guide/entries/${editing.entryId}`, "PUT", payload)
        : await call("/api/admin/guide/entries", "POST", payload);
    if (ok) {
      setEditing(null);
      showToast(editing.question ? "Approved. Loop can use it within a minute." : "Saved. Visitors see it within a minute.", "success");
    }
  }

  if (loadError) return <ErrorState message="Could not load the guide." onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;

  const edit = (e: EntryDto) => setEditing({ draft: draftFrom(e), entryId: e.id });
  const add = () => setEditing({ draft: EMPTY_DRAFT });
  const answer = (q: QuestionDto) => setEditing({ draft: draftFromQuestion(q), question: q });
  const openQueue = (f?: string) => {
    setFeature(f);
    setTab("queue");
  };

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next][0]);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Guide Bot Knowledge" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {TABS.map(([id, label], i) => (
          <button
            key={id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`guide-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`guide-panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            type="button"
            onClick={() => setTab(id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-[44px] shrink-0 rounded-lg px-3 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${tab === id ? "bg-brand-teal text-brand-onAccent" : "text-gray-700 hover:bg-brand-mint"}`}
          >
            {label}
            {id === "queue" && data.metrics.queue.open + data.metrics.queue.inReview > 0 ? ` (${data.metrics.queue.open + data.metrics.queue.inReview})` : ""}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`guide-panel-${tab}`} aria-labelledby={`guide-tab-${tab}`}>
        {tab === "overview" && <OverviewTab m={data.metrics} onOpenQueue={openQueue} />}
        {tab === "queue" && <QueueTab key={feature ?? "all"} entries={data.entries} categories={data.categories} busy={busy} call={call} onAnswer={answer} initialFeature={feature} />}
        {tab === "faq" && <FaqTab entries={data.entries} m={data.metrics} />}
        {tab === "knowledge" && <KnowledgeTab entries={data.entries} categories={data.categories} limit={data.limit} busy={busy} call={call} onEdit={edit} onAdd={add} />}
        {tab === "navigation" && <KnowledgeTab navigationOnly entries={data.entries} categories={data.categories} limit={data.limit} busy={busy} call={call} onEdit={edit} onAdd={add} />}
        {tab === "history" && <HistoryTab />}
        {tab === "categories" && <CategoriesTab entries={data.entries} categories={data.categories} />}
        {tab === "targets" && <TargetsTab />}
        {tab === "settings" && <SettingsTab enabled={data.enabled} busy={busy} limit={data.limit} onToggle={(v) => call("/api/admin/guide", "PUT", { enabled: v })} />}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.question ? "Approve an answer" : editing?.entryId ? "Edit answer" : "Write an answer"} size="lg">
        {editing && (
          <>
            {editing.question && (
              <p className="mt-3 rounded-lg bg-brand-mint px-3 py-2 text-sm text-brand-ink">
                Asked {editing.question.asked} {editing.question.asked === 1 ? "time" : "times"}. Once you save, this becomes an approved answer Loop can use. Other wordings below are added so it is found next time.
              </p>
            )}
            <EntryForm draft={editing.draft} categories={data.categories} onChange={(draft) => setEditing({ ...editing, draft })} onSave={save} onCancel={() => setEditing(null)} busy={busy} isEdit={!!editing.entryId} saveLabel={editing.question ? "Approve and publish" : "Save answer"} />
          </>
        )}
      </Modal>
    </div>
  );
}

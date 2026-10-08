"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ErrorState from "@/components/ui/ErrorState";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Input, Textarea } from "@/components/ui/Field";
import { DESTINATIONS } from "@/lib/guide/links";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";

interface Link {
  label: string;
  href: string;
}
interface Entry {
  id: string;
  question: string;
  answer: string;
  links: Link[];
  keywords: string[];
  enabled: boolean;
}
interface Unanswered {
  id: string;
  text: string;
  asked: number;
  lastAskedAt: string;
}
interface Payload {
  enabled: boolean;
  entries: Entry[];
  unanswered: Unanswered[];
  counts: { answered: number; dismissed: number; limit: number };
}

interface Draft {
  question: string;
  answer: string;
  keywords: string;
  links: Link[];
  enabled: boolean;
}

const EMPTY: Draft = { question: "", answer: "", keywords: "", links: [], enabled: true };

function draftFrom(e: Entry): Draft {
  return { question: e.question, answer: e.answer, keywords: e.keywords.join(", "), links: e.links, enabled: e.enabled };
}

function body(d: Draft) {
  return {
    question: d.question,
    answer: d.answer,
    keywords: d.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    links: d.links.filter((l) => l.label.trim() && l.href.trim()),
    enabled: d.enabled,
  };
}

/** Loop's switch, the answers written by hand, and the questions Loop could not answer. SUPER_ADMIN only. */
export default function GuideManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<{ draft: Draft; entryId?: string; unansweredId?: string } | null>(null);
  const [removing, setRemoving] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setLoadError(false);
    fetch("/api/admin/guide").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setLoadError(true));
  }, []);
  useEffect(load, [load]);

  async function call(url: string, method: string, payload?: unknown): Promise<boolean> {
    setBusy(true);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) {
      showToast((await res.json().catch(() => ({}))).error ?? "That did not work.", "error");
      return false;
    }
    load();
    return true;
  }

  async function save() {
    if (!editing) return;
    const payload = body(editing.draft);
    const ok = editing.unansweredId
      ? await call(`/api/admin/guide/unanswered/${editing.unansweredId}`, "POST", { action: "answer", ...payload })
      : editing.entryId
        ? await call(`/api/admin/guide/entries/${editing.entryId}`, "PUT", payload)
        : await call("/api/admin/guide/entries", "POST", payload);
    if (ok) {
      setEditing(null);
      showToast("Saved. Visitors see it within a minute.", "success");
    }
  }

  if (loadError) return <ErrorState message="Could not load the guide." onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;

  return (
    <div className="space-y-8">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-brand-ink">Loop on every page</h2>
            <p className="mt-1 text-sm text-gray-600">
              Loop answers from the written answers below and sends visitors to the right page. No AI service is used. Switching it off removes Loop from every page and brings back the plain Page Help button.
            </p>
          </div>
          <Toggle checked={data.enabled} label="Loop on every page" onChange={(v) => call("/api/admin/guide", "PUT", { enabled: v })} disabled={busy} />
        </div>
        <p className="text-xs text-gray-600">Changes reach visitors within a minute.</p>
      </Card>

      <section aria-labelledby="unanswered-heading">
        <h2 id="unanswered-heading" className="font-display text-lg font-semibold text-brand-ink">
          Questions Loop could not answer ({data.unanswered.length})
        </h2>
        <p className="mt-1 text-sm text-gray-600">Write an answer once and Loop uses it for everyone. Emails, links and numbers are removed before a question is kept, and nothing about who asked is stored.</p>
        <div className="mt-3 space-y-2">
          {data.unanswered.length === 0 && <EmptyState title="Nothing waiting" description="Questions Loop cannot answer will appear here, most asked first." />}
          {data.unanswered.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-brand-ink">{u.text}</p>
                <p className="text-xs text-gray-600">
                  Asked {u.asked} {u.asked === 1 ? "time" : "times"} · last {new Date(u.lastAskedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setEditing({ draft: { ...EMPTY, question: u.text.charAt(0).toUpperCase() + u.text.slice(1) }, unansweredId: u.id })}>
                  Write an answer
                </Button>
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => call(`/api/admin/guide/unanswered/${u.id}`, "POST", { action: "dismiss" })}>
                  Dismiss
                </Button>
              </div>
            </Card>
          ))}
        </div>
        {(data.counts.answered > 0 || data.counts.dismissed > 0) && (
          <p className="mt-2 text-xs text-gray-600">
            {data.counts.answered} answered and {data.counts.dismissed} dismissed so far.
          </p>
        )}
      </section>

      <section aria-labelledby="written-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="written-heading" className="font-display text-lg font-semibold text-brand-ink">
            Answers you wrote ({data.entries.length} of {data.counts.limit})
          </h2>
          <Button size="sm" onClick={() => setEditing({ draft: EMPTY })}>
            Add an answer
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {data.entries.length === 0 && <EmptyState title="No written answers yet" description="Loop already knows the built-in answers listed below. Add your own for anything specific to your platform." />}
          {data.entries.map((e) => (
            <Card key={e.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-ink">{e.question}</p>
                  <p className="mt-1 text-sm text-gray-600">{e.answer}</p>
                </div>
                <Toggle checked={e.enabled} label={`Use "${e.question}"`} disabled={busy} onChange={(v) => call(`/api/admin/guide/entries/${e.id}`, "PUT", { ...body(draftFrom(e)), enabled: v })} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {e.links.map((l) => (
                  <Badge key={l.href + l.label} variant="neutral">
                    {l.label} → {l.href}
                  </Badge>
                ))}
                <span className="ml-auto flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditing({ draft: draftFrom(e), entryId: e.id })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setRemoving(e)}>
                    Remove
                  </Button>
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="builtin-heading">
        <h2 id="builtin-heading" className="font-display text-lg font-semibold text-brand-ink">
          Built-in answers ({DEFAULT_ENTRIES.length})
        </h2>
        <p className="mt-1 text-sm text-gray-600">Loop always knows these. They are part of the platform code; an answer you write that matches a question better takes priority over them.</p>
        <details className="mt-3 rounded-xl border border-brand-gray bg-brand-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-teal">Show the questions</summary>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {DEFAULT_ENTRIES.map((e) => (
              <li key={e.id}>{e.question}</li>
            ))}
          </ul>
        </details>
      </section>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.entryId ? "Edit answer" : "Write an answer"} size="lg">
        {editing && <EntryForm draft={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} onSave={save} onCancel={() => setEditing(null)} busy={busy} />}
      </Modal>
      <ConfirmModal
        open={!!removing}
        title="Remove this answer?"
        description="Loop stops using it straight away. The question goes back to being unanswered if someone asks it again."
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await call(`/api/admin/guide/entries/${removing.id}`, "DELETE");
          setRemoving(null);
        }}
      />
    </div>
  );
}

function EntryForm({ draft, onChange, onSave, onCancel, busy }: { draft: Draft; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const setLink = (i: number, patch: Partial<Link>) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <Input label="Question" value={draft.question} onChange={(e) => set({ question: e.target.value })} maxLength={200} required hint="How a visitor would ask it." />
      <Textarea label="Answer" value={draft.answer} onChange={(e) => set({ answer: e.target.value })} rows={4} maxLength={600} required hint="Plain words, under 600 characters. Do not put prices or dates here; they change." />
      <Input label="Other words that should find this answer" value={draft.keywords} onChange={(e) => set({ keywords: e.target.value })} hint="Separate with commas, for example: refund, money back" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-brand-ink">Links shown with the answer (up to 5)</legend>
        <datalist id="guide-destinations">
          {DESTINATIONS.map((d) => (
            <option key={d.href} value={d.href}>
              {d.label}
            </option>
          ))}
        </datalist>
        {draft.links.map((l, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input label={`Link ${i + 1} label`} hideLabel compact value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="Label, for example Browse programs" maxLength={60} />
            <Input
              label={`Link ${i + 1} page`}
              hideLabel
              compact
              list="guide-destinations"
              value={l.href}
              onChange={(e) => {
                const href = e.target.value;
                const known = DESTINATIONS.find((d) => d.href === href);
                setLink(i, { href, ...(known && !l.label.trim() ? { label: known.label } : {}) });
              }}
              placeholder="/courses"
            />
            <Button type="button" size="sm" variant="secondary" onClick={() => set({ links: draft.links.filter((_, j) => j !== i) })}>
              Remove
            </Button>
          </div>
        ))}
        {draft.links.length < 5 && (
          <Button type="button" size="sm" variant="secondary" onClick={() => set({ links: [...draft.links, { label: "", href: "" }] })}>
            Add a link
          </Button>
        )}
        <p className="text-xs text-gray-600">Links must be pages on this site, like /jobs. Pick from the list or type a path.</p>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save answer
        </Button>
      </div>
    </form>
  );
}

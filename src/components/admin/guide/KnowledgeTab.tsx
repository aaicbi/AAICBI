"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import EmptyState from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Field";
import { DEFAULT_ENTRIES } from "@/lib/guide/defaults";
import { ROLE_LABEL, bodyOf, dateTime, draftFrom, type EntryDto, type Link } from "@/components/admin/guide/shared";

interface Version {
  version: number;
  action: string;
  question: string;
  answer: string;
  links: Link[];
  category: string | null;
  navHref: string | null;
  enabled: boolean;
  changedByName: string | null;
  changeNote: string | null;
  changedAt: string;
}

const ACTION_LABEL: Record<string, string> = { CREATED: "Created", UPDATED: "Updated", DISABLED: "Disabled", ENABLED: "Enabled", RESTORED: "Restored" };

/** The approved answers Loop uses: search, filter, edit, disable, see the history and restore an older version. */
export default function KnowledgeTab({ entries, categories, limit, busy, call, onEdit, onAdd, navigationOnly = false }: { entries: EntryDto[]; categories: string[]; limit: number; busy: boolean; call: (url: string, method: string, payload?: unknown) => Promise<boolean>; onEdit: (e: EntryDto) => void; onAdd: () => void; navigationOnly?: boolean }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [state, setState] = useState("");
  const [removing, setRemoving] = useState<EntryDto | null>(null);
  const [history, setHistory] = useState<{ entry: EntryDto; versions: Version[] | null } | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const shown = entries.filter((e) => {
    if (navigationOnly && !e.navHref && !e.target) return false;
    if (category && e.category !== category) return false;
    if (state === "on" && !e.enabled) return false;
    if (state === "off" && e.enabled) return false;
    const t = q.trim().toLowerCase();
    return !t || [e.question, e.answer, ...e.relatedQuestions, ...e.keywords].some((s) => s.toLowerCase().includes(t));
  });

  async function openHistory(entry: EntryDto) {
    setHistory({ entry, versions: null });
    const r = await fetch(`/api/admin/guide/entries/${entry.id}/versions`);
    const d = r.ok ? await r.json() : { versions: [] };
    setHistory({ entry, versions: d.versions });
  }

  return (
    <section aria-labelledby="kb-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="kb-heading" className="font-display text-lg font-semibold text-brand-ink">
            {navigationOnly ? "Navigation knowledge" : "Knowledge base"} ({shown.length}{shown.length !== entries.length ? ` of ${entries.length}` : ""})
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {navigationOnly
              ? "Answers that take people somewhere (Take me there) or point at a control (Show me). Only accounts that may open a page are offered the button."
              : `Approved answers Loop uses, ${entries.length} of ${limit}. Only answers a person wrote or approved are ever used. Every change is kept as a version.`}
          </p>
        </div>
        <Button size="sm" onClick={onAdd}>Add an answer</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input label="Search" compact type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers…" />
        <Select label="Category" compact value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Any</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <Select label="State" compact value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All</option>
          <option value="on">In use</option>
          <option value="off">Disabled</option>
        </Select>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={entries.length === 0 ? "No written answers yet" : "No answers match"} description={entries.length === 0 ? "Loop already knows the built-in answers listed below. Approve answers from the review queue, or add your own." : "Try a different search or filter."} />
      ) : (
        <ul className="space-y-2">
          {shown.map((e) => (
            <li key={e.id}>
              <Card className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-brand-ink">{e.question}</p>
                    <p className="mt-1 break-words text-sm text-gray-600">{e.answer}</p>
                  </div>
                  <Toggle checked={e.enabled} label={`Use "${e.question}"`} disabled={busy} onChange={(v) => call(`/api/admin/guide/entries/${e.id}`, "PUT", { ...bodyOf(draftFrom(e)), enabled: v, changeNote: v ? "Enabled" : "Disabled" })} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="neutral">Version {e.version}</Badge>
                  {e.category && <Badge variant="neutral">{e.category}</Badge>}
                  {!e.enabled && <Badge variant="warning">Disabled</Badge>}
                  {e.roles.length > 0 && <Badge variant="neutral">For {e.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}</Badge>}
                  {e.navHref && <Badge variant="success">Takes people to {e.navHref}</Badge>}
                  {e.target && <Badge variant="success">Shows {e.target}</Badge>}
                  <Badge variant="neutral">Given {e.served} {e.served === 1 ? "time" : "times"}</Badge>
                  {e.links.map((l) => (
                    <Badge key={l.href + l.label} variant="neutral">{l.label} → {l.href}</Badge>
                  ))}
                </div>
                {e.relatedQuestions.length > 0 && <p className="text-xs text-gray-600">Also found by: {e.relatedQuestions.join(" · ")}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-600">Updated {dateTime(e.updatedAt)}</span>
                  <span className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openHistory(e)}>History</Button>
                    <Button size="sm" variant="secondary" onClick={() => onEdit(e)}>Edit</Button>
                    <Button size="sm" variant="secondary" onClick={() => setRemoving(e)}>Remove</Button>
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {!navigationOnly && (
        <details className="rounded-xl border border-brand-gray bg-brand-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-teal">Built-in answers ({DEFAULT_ENTRIES.length}): part of the platform code</summary>
          <p className="mt-2 text-sm text-gray-600">Loop always knows these. An approved answer that matches a question better takes priority over them.</p>
          <ul className="mt-3 space-y-1 text-sm text-gray-700">
            {DEFAULT_ENTRIES.map((e) => (
              <li key={e.id}>{e.question}</li>
            ))}
          </ul>
        </details>
      )}

      <Modal open={!!history} onClose={() => setHistory(null)} title={history ? `History: ${history.entry.question}` : "History"} size="lg">
        {history && (
          <div className="mt-4 space-y-3">
            {history.versions === null ? (
              <p className="text-sm text-gray-600">Loading…</p>
            ) : history.versions.length === 0 ? (
              <p className="text-sm text-gray-600">No history yet.</p>
            ) : (
              history.versions.map((v) => (
                <Card key={v.version} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-brand-ink">
                      Version {v.version} · {ACTION_LABEL[v.action] ?? v.action}
                      {v.version === history.entry.version ? " (current)" : ""}
                    </p>
                    <p className="text-xs text-gray-600">{v.changedByName ?? "Unknown"} · {dateTime(v.changedAt)}</p>
                  </div>
                  {v.changeNote && <p className="text-xs text-gray-700">Note: {v.changeNote}</p>}
                  <p className="break-words text-sm text-gray-700">{v.answer}</p>
                  {v.version !== history.entry.version && (
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRestoring(v.version)}>Restore this version</Button>
                  )}
                </Card>
              ))
            )}
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={restoring !== null}
        title={`Restore version ${restoring}?`}
        description="It comes back as a new version. Nothing in the history is erased."
        confirmLabel="Restore"
        onCancel={() => setRestoring(null)}
        onConfirm={async () => {
          if (history && restoring !== null && (await call(`/api/admin/guide/entries/${history.entry.id}/restore`, "POST", { version: restoring }))) setHistory(null);
          setRestoring(null);
        }}
      />
      <ConfirmModal
        open={!!removing}
        title="Remove this answer?"
        description="Loop stops using it straight away and its history is deleted. To keep the history, switch the answer off instead."
        confirmLabel="Remove"
        danger
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await call(`/api/admin/guide/entries/${removing.id}`, "DELETE");
          setRemoving(null);
        }}
      />
    </section>
  );
}

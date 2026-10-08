"use client";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { GUIDE_CATEGORIES, GUIDE_ROLES } from "@/lib/guide/adminSchemas";
import { DESTINATIONS } from "@/lib/guide/links";
import { GUIDE_DESTINATIONS } from "@/lib/guide/navigation";
import { CONTROL_TARGETS } from "@/lib/guide/controlTargets";
import { ROLE_LABEL, type Draft, type Link } from "@/components/admin/guide/shared";

/**
 * One approved answer: what is asked, what Loop says, and optionally where
 * it sends people ("Take me there"), which control it lights up ("Show me"),
 * who it is for, and a note on what changed. Saving always keeps the
 * previous version in the history.
 */
export default function EntryForm({ draft, categories, onChange, onSave, onCancel, busy, saveLabel = "Save answer", isEdit = false }: { draft: Draft; categories: string[]; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void; busy: boolean; saveLabel?: string; isEdit?: boolean }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const setLink = (i: number, patch: Partial<Link>) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const targets = [
    ...GUIDE_DESTINATIONS.filter((d) => !draft.navHref || d.href === draft.navHref).map((d) => ({ id: d.target, label: `${d.label} (menu item)` })),
    ...CONTROL_TARGETS.filter((c) => !draft.navHref || c.page === "/" || draft.navHref.startsWith(c.page)).map((c) => ({ id: c.id, label: c.label })),
  ];
  const allCategories = [...new Set([...GUIDE_CATEGORIES, ...categories])];
  const allPages = [...new Set([...GUIDE_DESTINATIONS.map((d) => d.href), ...DESTINATIONS.map((d) => d.href)])].sort();
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
      <Textarea label="Other ways people ask this (one per line)" value={draft.related} onChange={(e) => set({ related: e.target.value })} rows={3} hint="Different wording helps Loop find this answer, for example: Where can I chat with an employer?" />
      <Input label="Other words that should find this answer" value={draft.keywords} onChange={(e) => set({ keywords: e.target.value })} hint="Separate with commas, for example: refund, money back" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Input label="Category" list="guide-categories" value={draft.category} onChange={(e) => set({ category: e.target.value })} maxLength={40} hint="Groups answers for the team." />
          <datalist id="guide-categories">
            {allCategories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-brand-ink">Who it is for</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {GUIDE_ROLES.map((r) => (
              <label key={r} className="inline-flex min-h-[32px] items-center gap-1.5 text-sm text-brand-ink">
                <input type="checkbox" checked={draft.roles.includes(r)} onChange={(e) => set({ roles: e.target.checked ? [...draft.roles, r] : draft.roles.filter((x) => x !== r) })} />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-600">Leave all unticked for everyone.</p>
        </fieldset>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-brand-gray p-3">
        <legend className="px-1 text-sm font-semibold text-brand-ink">Take people there (optional)</legend>
        <datalist id="guide-pages">
          {allPages.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="guide-targets">
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </datalist>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Page" list="guide-pages" value={draft.navHref} onChange={(e) => set({ navHref: e.target.value })} placeholder="/trainee/messages" hint="Adds a Take me there button. Only accounts that may open the page see it." />
          <Input label="Button label" value={draft.navLabel} onChange={(e) => set({ navLabel: e.target.value })} maxLength={40} placeholder="Open Messages" />
        </div>
        <Input label="Control to light up" list="guide-targets" value={draft.target} onChange={(e) => set({ target: e.target.value })} placeholder="nav:/trainee/messages" hint="Adds a Show me button that points at it with a soft glow." />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-brand-ink">Links shown with the answer (up to 5)</legend>
        {draft.links.map((l, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input label={`Link ${i + 1} label`} hideLabel compact value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} placeholder="Label, for example Browse programs" maxLength={60} />
            <Input
              label={`Link ${i + 1} page`}
              hideLabel
              compact
              list="guide-pages"
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

      {isEdit && <Input label="What changed (optional)" value={draft.changeNote} onChange={(e) => set({ changeNote: e.target.value })} maxLength={200} hint="Shown in this answer's history." />}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {saveLabel}
        </Button>
      </div>
    </form>
  );
}

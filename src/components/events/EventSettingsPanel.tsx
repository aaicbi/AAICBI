"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import Badge from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import type { ManagerData } from "@/components/events/managerShared";

const SWITCHES: { key: keyof ManagerData["settings"]; label: string; help: string }[] = [
  { key: "enabled", label: "Event Manager", help: "Turns events off everywhere: lists, pages, the feed and notifications. Nothing is deleted." },
  { key: "orgEventsEnabled", label: "Events for training organisations", help: "Lets organisations schedule events. Existing events stay visible." },
  { key: "promotionsEnabled", label: "Public promotion requests", help: "Lets organisations ask AAICBI to promote an event publicly." },
  { key: "registrationEnabled", label: "Registration", help: "Lets people register for events that ask for it." },
  { key: "showPast", label: "Show past events", help: "Lets people browse events that have finished." },
];

/** Global switches, the default join window, and the category list. */
export default function EventSettingsPanel({ data, canConfigure, canCategories, reload }: { data: ManagerData; canConfigure: boolean; canCategories: boolean; reload: () => void }) {
  const { showToast } = useToast();
  const [minutes, setMinutes] = useState(String(data.settings.joinOpensMinutes));
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  async function save(patch: Record<string, unknown>) {
    setProblem(null);
    const r = await fetch("/api/admin/events/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setProblem(j.error ?? "That did not work."); return; }
    showToast("Saved."); reload();
  }
  async function category(body: Record<string, unknown>) {
    const r = await fetch("/api/admin/events/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setProblem(j.error ?? "That did not work."); return; }
    setName(""); showToast("Saved."); reload();
  }
  return (
    <div className="space-y-6">
      {problem && <p role="alert" className="text-sm text-brand-rose">{problem}</p>}
      {canConfigure && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-brand-ink">Switches</h2>
          <ul className="mt-3 divide-y divide-brand-gray">
            {SWITCHES.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-4 py-3">
                <div><p className="font-semibold text-brand-ink">{s.label}</p><p className="text-xs text-gray-600">{s.help}</p></div>
                <Toggle label={s.label} checked={data.settings[s.key] as boolean} onChange={(v) => void save({ [s.key]: v })} />
              </li>
            ))}
          </ul>
          <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void save({ joinOpensMinutes: Number(minutes) }); }}>
            <Input label="Join button opens (minutes before start)" type="number" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} wrapperClassName="w-64" />
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </Card>
      )}
      {canCategories && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-brand-ink">Categories</h2>
          <ul className="mt-3 divide-y divide-brand-gray">
            {data.categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2"><span className="text-sm text-brand-ink">{c.name} {!c.active && <Badge variant="warning">Hidden</Badge>}</span><Button size="sm" variant="secondary" onClick={() => void category({ id: c.id, active: !c.active })}>{c.active ? "Hide" : "Show"}</Button></li>
            ))}
          </ul>
          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void category({ name }); }}>
            <Input label="New category" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} wrapperClassName="w-64" />
            <Button type="submit" variant="secondary" disabled={name.trim().length < 2}>Add</Button>
          </form>
        </Card>
      )}
      {!canConfigure && !canCategories && <p className="text-sm text-gray-600">You do not have permission to change event settings.</p>}
    </div>
  );
}

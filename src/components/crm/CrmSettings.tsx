"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import { Input, Textarea } from "@/components/ui/Field";

interface Data {
  canSwitch: boolean; canEditAgreement: boolean; platformRegistrations: number;
  organizations: { id: string; name: string; enabled: boolean; registrations: number }[];
  agreements: { id: string; version: number; title: string; body: string; active: boolean; createdAt: string; signed: number }[];
}

/** Super Admin: the CRM switch for each organization, and the agreement everyone signs. */
export default function CrmSettings() {
  const [d, setD] = useState<Data | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const load = useCallback(async () => { const r = await fetch("/api/admin/crm/settings"); if (r.ok) setD(await r.json()); }, []);
  useEffect(() => { void load(); }, [load]);
  const active = d?.agreements.find((a) => a.active) ?? null;
  useEffect(() => { if (active && !title && !body) { setTitle(active.title); setBody(active.body); } }, [active, title, body]);

  async function post(payload: Record<string, unknown>, done: string) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/crm/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? done : j.error ?? "That didn't work.");
    if (r.ok) await load();
  }

  if (!d) return <p className="text-sm text-gray-600">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      {msg && <p role="status" className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3 text-sm text-brand-ink">{msg}</p>}
      {d.canSwitch && (
        <Card data-testid="crm-orgs">
          <h2 className="font-display text-lg font-semibold text-brand-ink">CRM for training organizations</h2>
          <p className="mt-1 text-sm text-gray-600">Switch the CRM on for an organization and it sees the registrations for its own courses, privately. Switched off, registrations are still saved, so nobody who signs up is lost, and the organization sees them once you switch it on.</p>
          <ul className="mt-3 divide-y divide-brand-gray/60">
            <li className="flex items-center justify-between gap-3 py-3 text-sm text-brand-ink"><span><strong>AAICBI</strong><span className="block text-xs text-gray-600">Always on · {d.platformRegistrations} registration{d.platformRegistrations === 1 ? "" : "s"}</span></span><Badge variant="success">On</Badge></li>
            {d.organizations.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3 text-sm text-brand-ink"><span><strong>{o.name}</strong><span className="block text-xs text-gray-600">{o.registrations} registration{o.registrations === 1 ? "" : "s"}</span></span>
                <Toggle label={`CRM for ${o.name}`} checked={o.enabled} disabled={busy} onChange={(v) => post({ action: "switch", organizationId: o.id, enabled: v }, `${o.name}: CRM ${v ? "on" : "off"}.`)} /></li>
            ))}
            {d.organizations.length === 0 && <li className="py-3 text-sm text-gray-600">No approved organizations yet.</li>}
          </ul>
        </Card>
      )}
      <Card data-testid="crm-agreement">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Registration agreement</h2>
        <p className="mt-1 text-sm text-gray-600">Everyone who registers for any course signs this. Saving publishes a new version; older versions stay on file with everyone who signed them. This is starter text: have your lawyer approve the final wording.</p>
        {active && <p className="mt-2 text-sm text-brand-ink">Live now: version {active.version}, signed {active.signed} time{active.signed === 1 ? "" : "s"}.</p>}
        {d.canEditAgreement ? (
          <div className="mt-3 flex flex-col gap-3">
            <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
            <Textarea label="Agreement text" rows={14} value={body} onChange={(e) => setBody(e.target.value)} maxLength={12000} />
            <button type="button" disabled={busy || title.trim().length < 3 || body.trim().length < 100 || (!!active && active.title === title.trim() && active.body === body.trim())} onClick={() => post({ action: "agreement", title, body }, "New agreement version published.")} className="min-h-[44px] self-start rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-50" data-testid="agreement-publish">Publish as a new version</button>
          </div>
        ) : active && <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-line rounded-xl border border-brand-gray bg-brand-surface p-3 text-sm text-brand-ink">{active.body}</div>}
        {d.agreements.length > 1 && <details className="mt-4 text-sm text-brand-ink"><summary className="cursor-pointer font-semibold">Earlier versions</summary><ul className="mt-2 list-disc pl-5">{d.agreements.filter((a) => !a.active).map((a) => <li key={a.id}>Version {a.version}: {a.title}, signed {a.signed} time{a.signed === 1 ? "" : "s"}</li>)}</ul></details>}
      </Card>
    </div>
  );
}

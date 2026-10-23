"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import { Input, Select } from "@/components/ui/Field";

interface S { id: string; name: string; fromAddress: string; replyTo: string | null; stream: string; verified: boolean; active: boolean; allowOrganizations: boolean; sent: number }

/** Approved senders. "Verified" is the Super Admin's confirmation that the domain is verified in Resend; nothing is sent from a sender until it is on. */
export default function SendersManager() {
  const [rows, setRows] = useState<S[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState({ name: "", fromAddress: "", replyTo: "", stream: "SERVICE" });
  const load = useCallback(async () => { const r = await fetch("/api/admin/crm/senders"); if (r.ok) { const j = await r.json(); setRows(j.senders); setCanManage(j.canManage); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function post(body: Record<string, unknown>, ok: string) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/crm/senders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false); setMsg(r.ok ? ok : j.error ?? "That didn't work."); if (r.ok) await load();
  }
  if (!rows) return <p className="text-sm text-gray-600">Loading…</p>;
  return (
    <div className="flex flex-col gap-6">
      {msg && <p role="status" className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3 text-sm text-brand-ink">{msg}</p>}
      <Card className="!p-0" data-testid="senders">
        <div className="border-b border-brand-gray/60 p-4"><h2 className="font-display text-lg font-semibold text-brand-ink">Approved senders</h2><p className="mt-1 text-sm text-gray-600">Only these addresses can send. Turn <strong>Verified</strong> on only after the domain shows as verified in Resend, and set a reply-to so replies reach a real inbox.</p></div>
        <ul className="divide-y divide-brand-gray/60">
          {rows.map((s) => <SenderRow key={s.id} s={s} canManage={canManage} busy={busy} onChange={(patch, ok) => post({ action: "update", id: s.id, ...patch }, ok)} />)}
        </ul>
      </Card>
      {canManage && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-brand-ink">Add a sender</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Name shown" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
            <Input label="From address" type="email" value={n.fromAddress} onChange={(e) => setN({ ...n, fromAddress: e.target.value })} hint="On a domain you have verified in Resend." />
            <Input label="Reply to" type="email" value={n.replyTo} onChange={(e) => setN({ ...n, replyTo: e.target.value })} hint="An inbox someone reads." />
            <Select label="Stream" value={n.stream} onChange={(e) => setN({ ...n, stream: e.target.value })}><option value="SERVICE">Service (about registrations)</option><option value="MARKETING">Marketing (news and offers)</option></Select>
          </div>
          <div className="mt-3"><Button type="button" disabled={busy || !n.name.trim() || !n.fromAddress.trim()} onClick={() => post({ action: "create", name: n.name, fromAddress: n.fromAddress, replyTo: n.replyTo || null, stream: n.stream }, "Sender added. It stays off until you mark it verified.")}>Add sender</Button></div>
        </Card>
      )}
      <Card>
        <h2 className="font-display text-lg font-semibold text-brand-ink">Setting up a domain in Resend</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-brand-ink">
          <li>In Resend, open <strong>Domains</strong> and add the domain, such as <code>mail.aaicbi.org</code> (a subdomain).</li>
          <li>Add the records Resend shows (MX and TXT for SPF, a TXT for DKIM) where your DNS is managed, and add a DMARC TXT record on <code>_dmarc</code>.</li>
          <li>Press <strong>Verify</strong> in Resend. When it says Verified, come back and turn <strong>Verified</strong> on for the senders on that domain.</li>
          <li>Create an API key in Resend with sending access and add it to Vercel as <code>RESEND_API_KEY</code>. For delivery reports, add a webhook in Resend pointing to <code>/api/webhooks/resend</code> and put its signing secret in Vercel as <code>RESEND_WEBHOOK_SECRET</code>.</li>
        </ol>
        <p className="mt-2 text-xs text-gray-600">This screen cannot check Resend for you. The Verified switch is your confirmation. Never share the keys in chat or email.</p>
      </Card>
    </div>
  );
}

function SenderRow({ s, canManage, busy, onChange }: { s: S; canManage: boolean; busy: boolean; onChange: (patch: Record<string, unknown>, ok: string) => void }) {
  const [reply, setReply] = useState(s.replyTo ?? "");
  return (
    <li className="flex flex-col gap-2 p-4" data-testid="sender-row">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-brand-ink"><strong>{s.name}</strong> <Badge variant={s.stream === "SERVICE" ? "success" : "gold"}>{s.stream === "SERVICE" ? "Service" : "Marketing"}</Badge> <Badge variant={s.verified ? "success" : "warning"}>{s.verified ? "Verified" : "Not verified"}</Badge>{!s.active && <> <Badge variant="neutral">Off</Badge></>}<span className="block break-all text-xs text-gray-600">{s.fromAddress} · {s.sent} email{s.sent === 1 ? "" : "s"} sent</span></span></div>
      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1"><Input label="Reply to" type="email" value={reply} onChange={(e) => setReply(e.target.value)} compact /></div>
          <button type="button" disabled={busy || reply === (s.replyTo ?? "")} onClick={() => onChange({ replyTo: reply.trim() || null }, "Reply-to saved.")} className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-50">Save reply-to</button>
          <Toggle label={`${s.name} verified in Resend`} checked={s.verified} disabled={busy} onChange={(v) => onChange({ verified: v }, v ? "Marked verified." : "Marked not verified.")} />
          <span className="text-xs text-brand-ink">Verified</span>
          <Toggle label={`${s.name} active`} checked={s.active} disabled={busy} onChange={(v) => onChange({ active: v }, v ? "Switched on." : "Switched off.")} />
          <span className="text-xs text-brand-ink">Active</span>
          <Toggle label={`${s.name} open to organizations`} checked={s.allowOrganizations} disabled={busy} onChange={(v) => onChange({ allowOrganizations: v }, v ? "Organizations may use it." : "Organizations may not use it.")} />
          <span className="text-xs text-brand-ink">Organizations</span>
        </div>
      ) : <p className="text-xs text-gray-600">Reply to: {s.replyTo ?? "not set"}</p>}
    </li>
  );
}

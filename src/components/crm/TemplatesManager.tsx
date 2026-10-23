"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import RichEditor, { type RichEditorHandle } from "@/components/crm/RichEditor";
import { renderMerge, sanitizeHtml, wrapLetterhead, type MergeData } from "@/lib/crm/emailCore";

interface T { id: string; key: string; name: string; description: string | null; category: string; subject: string; body: string; version: number; active: boolean; senderId: string | null; senderName: string | null; updatedAt: string; used: number }
interface Data { canEdit: boolean; fields: { key: string; label: string }[]; templates: T[] }
const SAMPLE: MergeData = { first_name: "Amaka", last_name: "Okon", full_name: "Amaka Okon", course_name: "AI Automation Fundamentals", application_reference: "REG-2026-K7M2QX", course_start_date: "10 November 2026", assigned_staff_name: "Kufreh", organisation_name: "AAICBI", application_status: "Registered", support_email: "hello@aaicbi.org" };

/** Email templates: read them, and (with permission) change them. Every save that changes the words is a new version. */
export default function TemplatesManager() {
  const [d, setD] = useState<Data | null>(null);
  const [senders, setSenders] = useState<{ id: string; name: string }[]>([]);
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("SERVICE");
  const [senderId, setSenderId] = useState("");
  const [active, setActive] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [seed, setSeed] = useState({ html: "", key: "x" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const editor = useRef<RichEditorHandle>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/crm/templates");
    if (r.ok) setD(await r.json());
    const s = await fetch("/api/admin/crm/senders");
    if (s.ok) setSenders((await s.json()).senders.map((x: { id: string; name: string }) => ({ id: x.id, name: x.name })));
  }, []);
  useEffect(() => { void load(); }, [load]);

  function open(t: T | "new") {
    setMsg(null);
    if (t === "new") { setOpenId("new"); setName(""); setDesc(""); setCategory("SERVICE"); setSenderId(""); setActive(true); setSubject(""); setSeed({ html: "<p>Hi {{first_name}},</p><p></p><p>Warm regards,<br>{{assigned_staff_name}}</p>", key: `new-${Date.now()}` }); return; }
    setOpenId(t.id); setName(t.name); setDesc(t.description ?? ""); setCategory(t.category); setSenderId(t.senderId ?? ""); setActive(t.active); setSubject(t.subject); setSeed({ html: t.body, key: `${t.id}-${t.version}` });
  }
  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/crm/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: openId === "new" ? "create" : "update", id: openId === "new" ? undefined : openId, name, description: desc, category, senderId: senderId || null, active, subject, body }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error ?? "That didn't work."); return; }
    setMsg(openId === "new" ? "Template created." : j.version ? `Saved as version ${j.version}.` : "Saved.");
    await load();
    if (openId === "new" && j.id) setOpenId(j.id);
  }
  const preview = useMemo(() => wrapLetterhead({ bodyHtml: renderMerge(sanitizeHtml(body), SAMPLE, "html"), senderName: "AAICBI", organisationName: null, category: category as "SERVICE" | "MARKETING", stopUrl: "#", logoUrl: "/logo.svg" }), [body, category]);

  if (!d) return <p className="text-sm text-gray-600">Loading…</p>;
  const editing = openId !== null;
  return (
    <div className="flex flex-col gap-4">
      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-gray/60 p-4"><h2 className="font-display text-lg font-semibold text-brand-ink">Email templates</h2>{d.canEdit && <Button type="button" onClick={() => open("new")} data-testid="template-new">New template</Button>}</div>
        <ul className="divide-y divide-brand-gray/60" data-testid="template-list">
          {d.templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="min-w-0 text-sm text-brand-ink"><strong>{t.name}</strong> <Badge variant={t.category === "SERVICE" ? "success" : "gold"}>{t.category === "SERVICE" ? "Service" : "Marketing"}</Badge>{!t.active && <> <Badge variant="neutral">Off</Badge></>}<span className="block text-xs text-gray-600">{t.description ?? ""} · version {t.version} · used {t.used} time{t.used === 1 ? "" : "s"}</span></span>
              <button type="button" onClick={() => open(t)} className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint">{d.canEdit ? "Edit" : "View"}</button>
            </li>
          ))}
        </ul>
      </Card>
      {editing && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" data-testid="template-editor">
          <Card className="flex min-w-0 flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Name" value={name} disabled={!d.canEdit} onChange={(e) => setName(e.target.value)} />
              <Select label="Type" value={category} disabled={!d.canEdit} onChange={(e) => setCategory(e.target.value)}><option value="SERVICE">Service message</option><option value="MARKETING">Marketing message</option></Select>
            </div>
            <Textarea label="What it is for" rows={2} value={desc} disabled={!d.canEdit} onChange={(e) => setDesc(e.target.value)} maxLength={200} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="Suggested sender" value={senderId} disabled={!d.canEdit} onChange={(e) => setSenderId(e.target.value)}><option value="">Choose when writing</option>{senders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              <label className="flex min-h-[44px] items-center gap-2 self-end text-sm font-semibold text-brand-ink"><input type="checkbox" className="h-5 w-5" checked={active} disabled={!d.canEdit} onChange={(e) => setActive(e.target.checked)} /> Available to use</label>
            </div>
            <Input label="Subject" value={subject} disabled={!d.canEdit} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
            {d.canEdit ? <RichEditor ref={editor} initialHtml={seed.html} resetKey={seed.key} onChange={setBody} label="Template message" /> : <div className="rounded-xl border border-brand-gray bg-brand-surface p-3 text-sm text-brand-ink" dangerouslySetInnerHTML={{ __html: sanitizeHtml(seed.html) }} />}
            {d.canEdit && <div className="flex flex-wrap gap-1.5">{d.fields.map((f) => <button key={f.key} type="button" title={f.label} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.current?.insertText(`{{${f.key}}}`)} className="min-h-[36px] rounded-lg border border-brand-gray bg-brand-mint px-2 font-mono text-xs text-brand-teal">{`{{${f.key}}}`}</button>)}</div>}
            {d.canEdit && <div className="flex flex-wrap items-center gap-3"><Button type="button" disabled={busy || !name.trim() || !subject.trim()} onClick={save} data-testid="template-save">{busy ? "Saving…" : "Save"}</Button><p className="text-xs text-gray-600">Saving changed words makes a new version. Emails already sent keep the version they used.</p></div>}
            {msg && <p role="status" className="text-sm text-brand-ink" data-testid="template-msg">{msg}</p>}
          </Card>
          <Card className="min-w-0"><h3 className="font-display text-lg font-semibold text-brand-ink">Preview</h3><p className="mb-2 text-sm text-brand-ink"><strong>Subject:</strong> {renderMerge(subject, SAMPLE, "text")}</p><iframe title="Template preview" sandbox="" srcDoc={preview} className="h-[480px] w-full rounded-xl border border-brand-gray bg-white" /></Card>
        </div>
      )}
    </div>
  );
}

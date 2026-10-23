"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import RichEditor, { type RichEditorHandle } from "@/components/crm/RichEditor";
import { attachmentProblem, htmlToText, renderMerge, sanitizeHtml, wrapLetterhead, type Category, type MergeData } from "@/lib/crm/emailCore";

interface Opts {
  registration: { id: string; reference: string; course: string };
  recipient: { name: string; email: string; serviceOk: boolean; marketingOk: boolean; optedOut: boolean; suppressed: boolean; followUp: boolean; newsletter: boolean };
  viaOrganization: string | null; replyToOrganization: string | null; staffName: string;
  senders: { id: string; name: string; fromAddress: string; stream: string; verified: boolean; replyTo: string | null; usable: boolean }[];
  templates: { id: string; key: string; name: string; category: string; subject: string; body: string; version: number; senderId: string | null }[];
  drafts: { id: string; subjectRaw: string; bodyRaw: string; status: string; scheduledFor: string | null; senderId: string; templateId: string | null; category: string }[];
  fields: { key: string; label: string }[]; sample: MergeData;
}
type Done = { kind: "ok" | "bad"; text: string } | null;

const toBase64 = (f: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(r.error); r.readAsDataURL(f); });

/** Writes one email to a registrant: sender, template, subject, message, a preview, and send / test / draft / schedule. */
export default function EmailComposer({ registrationId }: { registrationId: string }) {
  const [o, setO] = useState<Opts | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [senderId, setSenderId] = useState("");
  const [category, setCategory] = useState<Category>("SERVICE");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [seed, setSeed] = useState({ html: "", key: "start" });
  const [draftId, setDraftId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [when, setWhen] = useState("");
  const [showWhen, setShowWhen] = useState(false);
  const [phone, setPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const editor = useRef<RichEditorHandle>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch(`/api/admin/crm/email/compose?registrationId=${encodeURIComponent(registrationId)}`);
      if (!r.ok) { setErr((await r.json().catch(() => ({}))).error ?? "We could not open the composer."); return; }
      const d: Opts = await r.json();
      setO(d);
      const usable = d.senders.find((s) => s.usable && s.stream === "SERVICE") ?? d.senders.find((s) => s.usable) ?? d.senders[0];
      setSenderId(usable?.id ?? "");
      const draft = d.drafts[0];
      if (draft) { setDraftId(draft.id); setSenderId(draft.senderId); setCategory(draft.category as Category); setTemplateId(draft.templateId ?? ""); setSubject(draft.subjectRaw); setSeed({ html: draft.bodyRaw, key: `draft-${draft.id}` }); if (draft.scheduledFor) { setShowWhen(true); setWhen(draft.scheduledFor.slice(0, 16)); } }
    })();
  }, [registrationId]);

  const sender = o?.senders.find((s) => s.id === senderId) ?? null;
  const blocked = !o ? null
    : category === "SERVICE" && !o.recipient.serviceOk ? (o.recipient.optedOut ? "This person asked us to stop all messages." : o.recipient.suppressed ? "Email to this address is switched off because an earlier email bounced or was reported as spam." : "This person did not agree to be contacted by email.")
    : category === "MARKETING" && !o.recipient.marketingOk ? "This person did not agree to receive news and offers, so a marketing message cannot be sent to them. Switch to a service message."
    : null;
  const senderBlocked = sender && !sender.usable ? (!sender.verified ? "This sender is not verified yet. A Super Admin has to confirm the domain in Resend first." : "This sender has no reply-to address yet.") : null;
  const attachError = useMemo(() => attachmentProblem(files.map((f) => ({ filename: f.name, size: f.size }))), [files]);

  const preview = useMemo(() => {
    if (!o) return "";
    const data = { ...o.sample, support_email: o.replyToOrganization ?? sender?.replyTo ?? "" };
    const inner = renderMerge(sanitizeHtml(body), data, "html");
    return wrapLetterhead({ bodyHtml: inner, senderName: sender?.name ?? "AAICBI", organisationName: o.viaOrganization, category, stopUrl: "#", logoUrl: "/logo.svg" });
  }, [o, body, sender, category]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = o?.templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject); setSeed({ html: t.body, key: `tpl-${t.id}-${Date.now()}` }); setCategory(t.category as Category);
    if (t.senderId && o?.senders.some((s) => s.id === t.senderId)) setSenderId(t.senderId);
  }

  async function act(action: "send" | "test" | "draft" | "schedule") {
    if (!o) return;
    setBusy(true); setDone(null);
    try {
      const attachments = await Promise.all(files.map(async (f) => ({ filename: f.name, contentBase64: await toBase64(f) })));
      const res = await fetch("/api/admin/crm/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, registrationId, senderId, templateId: templateId || null, category, subject, body, draftId, scheduledFor: action === "schedule" && when ? new Date(when).toISOString() : null, attachments }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.id && (action === "draft" || action === "schedule")) setDraftId(j.id);
      if (!res.ok) setDone({ kind: "bad", text: j.error ?? (j.status === "FAILED" ? `Resend did not accept it: ${j.error}` : "That did not work.") });
      else setDone({ kind: "ok", text: action === "send" ? "Resend accepted the email. It will show as delivered on the timeline when Resend reports it." : action === "test" ? "A test email was sent to you. Check your inbox." : action === "draft" ? "Draft saved." : "Scheduled. It goes out within an hour of that time, and the person's consent is checked again then." });
    } catch {
      setDone({ kind: "bad", text: "We could not reach the server. Your email is still here. Try again." });
    }
    setBusy(false);
  }

  if (err) return <p role="alert" className="text-sm text-brand-rose">{err}</p>;
  if (!o) return <p className="text-sm text-gray-600">Loading…</p>;
  const replyTo = o.replyToOrganization ?? sender?.replyTo ?? null;
  const cant = !!blocked || !!senderBlocked || !!attachError || !subject.trim() || htmlToText(sanitizeHtml(body)).length < 2;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4 rounded-2xl border border-brand-gray/60 bg-card-gradient p-4 sm:p-5" data-testid="composer">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="From" value={senderId} onChange={(e) => setSenderId(e.target.value)} data-testid="email-sender">
            {o.senders.map((s) => <option key={s.id} value={s.id}>{s.name} &lt;{s.fromAddress}&gt;{s.usable ? "" : s.verified ? " (no reply-to yet)" : " (not verified yet)"}</option>)}
          </Select>
          <Select label="Type of message" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            <option value="SERVICE">Service message (about their registration)</option>
            <option value="MARKETING">Marketing message (news and offers)</option>
          </Select>
        </div>
        {o.viaOrganization && <p className="text-sm text-brand-ink">This goes out as <strong>{o.viaOrganization} via AAICBI</strong>. Replies come to <strong>{o.replyToOrganization}</strong>.</p>}
        <div>
          <p className="text-sm font-bold text-brand-ink">To</p>
          <p className="text-sm text-brand-ink">{o.recipient.name} &lt;{o.recipient.email}&gt; · {o.registration.course} · {o.registration.reference}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2.5 py-1 ${o.recipient.followUp && !o.recipient.optedOut ? "bg-brand-mint text-brand-teal" : "bg-brand-roseLight text-brand-rose"}`}>{o.recipient.followUp && !o.recipient.optedOut ? "Agreed to follow-up" : "No follow-up consent"}</span>
            <span className={`rounded-full px-2.5 py-1 ${o.recipient.newsletter && !o.recipient.optedOut ? "bg-brand-mint text-brand-teal" : "border border-brand-gray text-brand-ink"}`}>Newsletter: {o.recipient.newsletter && !o.recipient.optedOut ? "yes" : "no"}</span>
            {o.recipient.suppressed && <span className="rounded-full bg-brand-roseLight px-2.5 py-1 text-brand-rose">Address switched off</span>}
          </div>
        </div>
        {blocked && <p role="alert" className="rounded-xl border border-brand-rose/40 bg-brand-roseLight p-3 text-sm text-brand-rose" data-testid="email-blocked">{blocked}</p>}
        {senderBlocked && <p role="alert" className="rounded-xl border border-brand-gold/50 bg-brand-surface p-3 text-sm text-brand-ink" data-testid="sender-blocked">{senderBlocked}</p>}
        <Select label="Template" value={templateId} onChange={(e) => pickTemplate(e.target.value)} data-testid="email-template">
          <option value="">No template (write your own)</option>
          {o.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} data-testid="email-subject" />
        <div>
          <p className="mb-1 text-sm font-bold text-brand-ink">Message</p>
          <RichEditor ref={editor} initialHtml={seed.html} resetKey={seed.key} onChange={setBody} label="Message" />
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Fields that fill in for each person">
            {o.fields.map((f) => <button key={f.key} type="button" title={f.label} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.current?.insertText(`{{${f.key}}}`)} className="min-h-[36px] rounded-lg border border-brand-gray bg-brand-mint px-2 font-mono text-xs text-brand-teal hover:bg-brand-surface">{`{{${f.key}}}`}</button>)}
          </div>
          <p className="mt-1 text-xs text-gray-600">Only these fields work. If one is empty for a person, a safe fallback is used, never a broken placeholder.</p>
        </div>
        <div>
          <label htmlFor="att" className="text-sm font-bold text-brand-ink">Attachments (optional)</label>
          <input id="att" type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} className="mt-1 block w-full text-sm text-brand-ink" />
          <p className="mt-1 text-xs text-gray-600">Up to 3 files, 3 MB together. PDF, images, Word, Excel, PowerPoint, text or CSV.</p>
          {attachError && <p role="alert" className="mt-1 text-sm text-brand-rose">{attachError}</p>}
        </div>
        {replyTo && <p className="text-xs text-gray-600">Replies go to {replyTo}.</p>}
        {showWhen && <Input label="Send at" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} hint="Goes out within an hour of this time. Consent is checked again then." />}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" disabled={busy || cant} onClick={() => act("send")} data-testid="email-send">{busy ? "Working…" : "Send now"}</Button>
          <Button type="button" variant="secondary" disabled={busy || !subject.trim() || !!senderBlocked} onClick={() => act("test")} data-testid="email-test">Send test to me</Button>
          <Button type="button" variant="secondary" disabled={busy || !subject.trim()} onClick={() => act("draft")} data-testid="email-draft">Save draft</Button>
          {showWhen ? <Button type="button" variant="secondary" disabled={busy || cant || !when} onClick={() => act("schedule")} data-testid="email-schedule">Schedule</Button> : <Button type="button" variant="secondary" disabled={busy || cant} onClick={() => setShowWhen(true)}>Schedule…</Button>}
        </div>
        {done && <p role={done.kind === "bad" ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${done.kind === "bad" ? "border-brand-rose/40 bg-brand-roseLight text-brand-rose" : "border-brand-gray/60 bg-brand-surface text-brand-ink"}`} data-testid="email-result">{done.text} {done.kind === "ok" && <Link href={`/admin/crm?r=${o.registration.id}`} className="font-semibold text-brand-teal underline">Back to the registration</Link>}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-brand-gray/60 bg-card-gradient p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-semibold text-brand-ink">Preview</h2>
          <div role="group" aria-label="Preview size" className="inline-flex overflow-hidden rounded-full border border-brand-gray text-sm font-semibold">
            <button type="button" aria-pressed={!phone} onClick={() => setPhone(false)} className={`min-h-[40px] px-3 ${!phone ? "bg-brand-action text-brand-onAccent" : "bg-brand-surface text-brand-ink"}`}>Desktop</button>
            <button type="button" aria-pressed={phone} onClick={() => setPhone(true)} className={`min-h-[40px] px-3 ${phone ? "bg-brand-action text-brand-onAccent" : "bg-brand-surface text-brand-ink"}`}>Phone</button>
          </div></div>
        <p className="text-sm text-brand-ink"><strong>Subject:</strong> {renderMerge(subject, { ...o.sample }, "text") || <span className="text-gray-600">(none yet)</span>}</p>
        <iframe title="Email preview" sandbox="" srcDoc={preview} className={`h-[520px] w-full rounded-xl border border-brand-gray bg-white ${phone ? "mx-auto max-w-[340px]" : ""}`} data-testid="email-preview" />
        <p className="text-xs text-gray-600">A plain-text version is made automatically for mail apps that need it. The preview uses this person&apos;s details.</p>
      </div>
    </div>
  );
}

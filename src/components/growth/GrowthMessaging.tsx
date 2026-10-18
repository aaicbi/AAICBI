"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Toggle from "@/components/ui/Toggle";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

type Channel = "MANUAL" | "WHATSAPP" | "EMAIL";
interface Overview {
  settings: { enabled: boolean; channel: Channel; dailyCap: number; quiet: { start: number; end: number } };
  providers: { whatsapp: { enabled: boolean; configured: boolean }; email: { configured: boolean }; webhook: { url: string; verifyTokenSet: boolean; appSecretSet: boolean } };
  templates: { kind: string; label: string; body: string; waTemplate: string; custom: boolean; metaText: string; defaultBody: string }[];
  counts: { leads: number; withPhone: number; withEmail: number; optedOut: number; claimed: number; sentLastDay: number; byStatus: Record<string, number> };
  outbox: { id: string; kind: string; label: string; channel: string; status: string; to: string; body: string; error: string | null; at: string; optedOut: boolean; waMe: string | null }[];
  quietNow: boolean;
  run?: { enabled: boolean; queued: number; sent: number; manual: number; failed: number; skipped: number; quiet: boolean; capped: boolean } | null;
}

const CHANNEL_LABEL: Record<Channel, string> = { MANUAL: "By hand (WhatsApp links)", WHATSAPP: "WhatsApp, automatic", EMAIL: "Email" };
const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "neutral"> = { SENT: "success", DELIVERED: "success", READ: "success", MANUAL_SENT: "success", QUEUED: "neutral", MANUAL_PENDING: "warning", FAILED: "danger", SKIPPED: "neutral" };
const STATUS_LABEL: Record<string, string> = { QUEUED: "Queued", SENT: "Sent", DELIVERED: "Delivered", READ: "Read", FAILED: "Failed", SKIPPED: "Skipped", MANUAL_PENDING: "Waiting for you", MANUAL_SENT: "Sent by hand" };

/** Super Admin: follow-up messages to people who saved their taster score. Off until switched on; every message carries a stop link. */
export default function GrowthMessaging() {
  const { showToast } = useToast();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [cap, setCap] = useState("");
  const [quiet, setQuiet] = useState({ start: 21, end: 7 });
  const [drafts, setDrafts] = useState<Record<string, { body: string; wa: string }>>({});
  const [msgProblem, setMsgProblem] = useState<Record<string, string>>({});

  const adopt = useCallback((o: Overview) => {
    setData(o);
    setCap(String(o.settings.dailyCap));
    setQuiet(o.settings.quiet);
    setDrafts(Object.fromEntries(o.templates.map((t) => [t.kind, { body: t.body, wa: t.waTemplate }])));
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/growth/messaging");
    if (!res.ok) { setError("The messaging settings could not be loaded."); return; }
    adopt(await res.json());
    setError(null);
  }, [adopt]);
  useEffect(() => { void load(); }, [load]);

  async function send(body: Record<string, unknown>, done?: string, key?: string) {
    setBusy(true); setProblem(null);
    if (key) setMsgProblem((p) => ({ ...p, [key]: "" }));
    const res = await fetch("/api/admin/growth/messaging", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { if (key) setMsgProblem((p) => ({ ...p, [key]: json.error ?? "That didn't work." })); else setProblem(json.error ?? "That didn't work."); return; }
    adopt(json);
    if (json.run) showToast(`Queued ${json.run.queued}, sent ${json.run.sent}, waiting for you ${json.run.manual}, failed ${json.run.failed}${json.run.quiet ? ". It is quiet hours, so nothing was sent." : ""}${json.run.capped ? ". The daily limit was reached." : ""}`);
    else if (done) showToast(done);
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={3} />;
  const { settings, providers, counts } = data;
  const ready = settings.channel === "MANUAL" || (settings.channel === "WHATSAPP" && providers.whatsapp.configured) || (settings.channel === "EMAIL" && providers.email.configured);

  return (
    <section aria-labelledby="msg-h" className="space-y-5" data-testid="growth-messaging">
      <div>
        <h2 id="msg-h" className="font-display text-lg font-semibold text-brand-ink">Follow-up messages</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">People who save their taster score and tick the consent box get up to four messages: a welcome, two reminders to start Module 1, and a nudge to finish it. Nobody is messaged after they opt out or pay, or between 21:00 and 07:00 in Nigeria. Every message has a stop link.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><p className="font-semibold text-brand-ink">Send follow-up messages</p><p className="text-sm text-gray-600">Off until you switch it on.</p></div>
          <Toggle checked={settings.enabled} disabled={busy} label="Send follow-up messages" onChange={(v) => send({ action: "settings", enabled: v }, v ? "Messaging is on." : "Messaging is off.")} />
        </div>
        {problem && <p className="mt-2 text-sm text-brand-rose" role="alert">{problem}</p>}

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold text-brand-ink">How to send</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(["MANUAL", "WHATSAPP", "EMAIL"] as Channel[]).map((c) => {
              const ok = c === "MANUAL" || (c === "WHATSAPP" ? providers.whatsapp.configured : providers.email.configured);
              return (
                <button key={c} type="button" disabled={busy} onClick={() => send({ action: "settings", channel: c }, "Saved.")} aria-pressed={settings.channel === c} data-testid={`channel-${c}`}
                  className={`min-h-[48px] rounded-xl border px-3 py-2 text-left text-sm ${settings.channel === c ? "border-brand-action bg-brand-mint text-brand-tealDeep" : "border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"}`}>
                  <span className="block font-semibold">{CHANNEL_LABEL[c]}</span>
                  <span className="block text-xs">{c === "MANUAL" ? "Works today. You send each message yourself." : ok ? "Set up on this server." : "Not set up on this server yet."}</span>
                </button>
              );
            })}
          </div>
          {!ready && <p className="mt-2 text-sm text-brand-rose">This way of sending is not set up on this server, so messaging cannot be switched on with it yet.</p>}
        </fieldset>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm"><span className="font-semibold text-brand-ink">Most messages a day</span>
            <input inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="daily-cap" /></label>
          <label className="block text-sm"><span className="font-semibold text-brand-ink">Quiet from (hour, Nigeria)</span>
            <input inputMode="numeric" value={quiet.start} onChange={(e) => setQuiet({ ...quiet, start: Number(e.target.value) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="quiet-start" /></label>
          <label className="block text-sm"><span className="font-semibold text-brand-ink">Quiet until (hour)</span>
            <input inputMode="numeric" value={quiet.end} onChange={(e) => setQuiet({ ...quiet, end: Number(e.target.value) })} className="mt-1 min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="quiet-end" /></label>
        </div>
        <p className="mt-1 text-xs text-gray-600">Quiet hours are whole hours, 0 to 23. The same hour in both boxes means no quiet hours.{data.quietNow ? " It is quiet hours right now." : ""}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => send({ action: "settings", dailyCap: cap, quiet }, "Saved.")} className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="save-limits">Save limits</button>
          <button type="button" disabled={busy || !settings.enabled} onClick={() => send({ action: "run" })} className="min-h-[44px] rounded-full border border-brand-action px-5 text-sm font-semibold text-brand-action hover:bg-brand-mint disabled:opacity-60" data-testid="run-now">Send due messages now</button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-brand-ink">Who has saved their score</h3>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5" data-testid="msg-counts">
          {[["Saved", counts.leads], ["With a number", counts.withPhone], ["Started Module 1", counts.claimed], ["Opted out", counts.optedOut], ["Sent in 24 hours", counts.sentLastDay]].map(([k, v]) => (
            <div key={k as string} className="rounded-xl bg-brand-surface p-3"><dt className="text-xs text-gray-600">{k}</dt><dd className="font-display text-xl font-bold text-brand-ink">{v}</dd></div>
          ))}
        </dl>
      </Card>

      <div>
        <h3 className="font-display text-base font-semibold text-brand-ink">The messages</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">Use {"{name}"}, {"{rank}"}, {"{course}"}, {"{link}"} and {"{stop}"}. Every message must include {"{stop}"}. For WhatsApp, Meta only lets us start a chat with a message it has approved, so register each text below with Meta under the template name shown, with the five variables in this order.</p>
        <div className="mt-3 space-y-3">
          {data.templates.map((t) => {
            const d = drafts[t.kind] ?? { body: t.body, wa: t.waTemplate };
            return (
              <div key={t.kind} className="rounded-2xl border border-brand-gray/60 bg-brand-surface p-4" data-testid={`tpl-${t.kind}`}>
                <p className="font-semibold text-brand-ink">{t.label} {t.custom ? <Badge variant="gold">Edited</Badge> : null}</p>
                <label htmlFor={`body-${t.kind}`} className="mt-2 block text-sm font-semibold text-brand-ink">Message</label>
                <textarea id={`body-${t.kind}`} rows={4} value={d.body} onChange={(e) => setDrafts({ ...drafts, [t.kind]: { ...d, body: e.target.value } })} className="mt-1 w-full rounded-lg border border-brand-gray bg-brand-surface p-3 text-base text-brand-ink" data-testid={`body-${t.kind}`} />
                <label htmlFor={`wa-${t.kind}`} className="mt-2 block text-sm font-semibold text-brand-ink">WhatsApp template name</label>
                <input id={`wa-${t.kind}`} value={d.wa} onChange={(e) => setDrafts({ ...drafts, [t.kind]: { ...d, wa: e.target.value } })} className="mt-1 min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" />
                <details className="mt-2 text-sm text-gray-600"><summary className="cursor-pointer font-semibold text-brand-teal">Text to register with Meta</summary><p className="mt-1 break-words rounded-lg bg-brand-mint p-2 text-brand-tealDeep">{t.metaText}</p><p className="mt-1">Variables: {"{{1}}"} first name, {"{{2}}"} rank, {"{{3}}"} course, {"{{4}}"} link, {"{{5}}"} stop link.</p></details>
                {msgProblem[t.kind] && <p className="mt-2 text-sm text-brand-rose" role="alert">{msgProblem[t.kind]}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={() => send({ action: "template", kind: t.kind, body: d.body, waTemplate: d.wa }, "Message saved.", t.kind)} className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid={`save-${t.kind}`}>Save message</button>
                  {t.custom && <button type="button" disabled={busy} onClick={() => send({ action: "resetTemplate", kind: t.kind }, "Back to the standard message.", t.kind)} className="min-h-[44px] rounded-full border border-brand-gray px-5 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60">Back to standard</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <h3 className="font-semibold text-brand-ink">Setting up WhatsApp</h3>
        <ul className="mt-2 space-y-1 text-sm text-brand-ink">
          <li>WhatsApp sending: {providers.whatsapp.configured ? <Badge variant="success">Set up</Badge> : <Badge variant="neutral">Not set up</Badge>}</li>
          <li>Delivery receipts and STOP replies: {providers.webhook.verifyTokenSet && providers.webhook.appSecretSet ? <Badge variant="success">Ready</Badge> : <Badge variant="neutral">Not set up</Badge>}</li>
          <li>Email sending: {providers.email.configured ? <Badge variant="success">Set up</Badge> : <Badge variant="neutral">Not set up</Badge>}</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">Register this address with Meta as the webhook: <span className="break-all font-semibold text-brand-ink">{providers.webhook.url}</span></p>
        <p className="mt-2 text-sm text-gray-600">On the server set WHATSAPP_ENABLED, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET. Until then, use &quot;By hand&quot;. Automatic WhatsApp has been tested against a stand-in server only, not against Meta itself.</p>
      </Card>

      <div>
        <h3 className="font-display text-base font-semibold text-brand-ink">Latest messages</h3>
        {data.outbox.length === 0 ? <p className="mt-1 text-sm text-gray-600">None yet. Messages appear here once someone saves their score and messaging is on.</p> : (
          <ul className="mt-2 space-y-2" data-testid="outbox">
            {data.outbox.map((m) => (
              <li key={m.id} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3" data-testid="outbox-row">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold text-brand-ink"><span className="break-all">{m.to || "No contact"}</span> · {m.label}</p>
                  <Badge variant={STATUS_VARIANT[m.status] ?? "neutral"}>{STATUS_LABEL[m.status] ?? m.status}</Badge>
                </div>
                <p className="mt-1 break-words text-sm text-gray-700">{m.body}</p>
                {m.error && <p className="mt-1 text-sm text-brand-rose">{m.error}</p>}
                <p className="mt-1 text-xs text-gray-600">{new Date(m.at).toLocaleString()} · {m.channel.toLowerCase()}{m.optedOut ? " · opted out" : ""}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.waMe && !m.optedOut && <a href={m.waMe} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[40px] items-center rounded-full bg-brand-action px-4 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover" data-testid="open-whatsapp">Send on WhatsApp</a>}
                  {m.status === "MANUAL_PENDING" && <button type="button" disabled={busy} onClick={() => send({ action: "sent", id: m.id }, "Marked as sent.")} className="min-h-[40px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60" data-testid="mark-sent">Mark as sent</button>}
                  {m.status === "FAILED" && !m.optedOut && <button type="button" disabled={busy} onClick={() => send({ action: "retry", id: m.id }, "Queued again.")} className="min-h-[40px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60">Try again</button>}
                  {["QUEUED", "MANUAL_PENDING", "FAILED"].includes(m.status) && <button type="button" disabled={busy} onClick={() => send({ action: "skip", id: m.id }, "Skipped.")} className="min-h-[40px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60">Skip</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Secret { set: boolean; hint: string | null }
interface Status {
  enabled: boolean; source: "settings" | "environment" | "none"; canStoreSecrets: boolean;
  accessToken: Secret; appSecret: Secret; phoneNumberId: string | null; verifyToken: string | null; templateLang: string;
  webhookUrl: string; savedAt: string | null; missing: string[];
}
interface Test { ok: boolean; error?: string; displayNumber?: string; verifiedName?: string }

const input = "mt-1 block min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink";
const btn = "min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60";

/** Super Admin: paste the WhatsApp Cloud API credentials, test them, and switch WhatsApp on or off. Off until switched on. */
export default function GrowthWhatsApp() {
  const { showToast } = useToast();
  const [st, setSt] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [test, setTest] = useState<Test | null>(null);
  const [f, setF] = useState({ accessToken: "", phoneNumberId: "", appSecret: "", templateLang: "" });
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/growth/whatsapp", { cache: "no-store" });
    if (!res.ok) { setError("The WhatsApp settings could not be loaded."); return; }
    setSt(await res.json());
    setError(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(body: Record<string, unknown>, done?: string) {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/admin/growth/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(json.error ?? "That did not work."); return false; }
    setSt(json.status);
    if (body.action === "test") setTest(json.test);
    if (done) showToast(done);
    return true;
  }

  function copy(label: string, text: string) {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(null), 1500); }).catch(() => undefined);
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!st) return <SkeletonList rows={3} />;
  const filled = Object.values(f).some((v) => v.trim() !== "");

  return (
    <section aria-labelledby="wa-h" data-testid="growth-whatsapp">
      <h2 id="wa-h" className="font-display text-lg font-semibold text-brand-ink">WhatsApp connection</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Paste the details from your Meta WhatsApp Business account here when you have them. Nothing is sent until you save them and switch WhatsApp on. The secrets are stored encrypted and never shown again, only their last four characters.</p>

      <Card className="mt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-brand-ink">WhatsApp sending {st.enabled ? <Badge variant="success">On</Badge> : <Badge variant="neutral">Off</Badge>}</p>
            <p className="text-sm text-gray-600">Covers the growth follow-ups and any other WhatsApp message the platform sends. Off means none are sent.</p>
          </div>
          <Toggle checked={st.enabled} disabled={busy || (!st.enabled && st.missing.length > 0)} label="WhatsApp sending" onChange={(v) => void send({ action: "enable", enabled: v }, v ? "WhatsApp is on." : "WhatsApp is off.")} />
        </div>
        {!st.enabled && st.missing.length > 0 && <p className="mt-2 text-sm text-gray-600" data-testid="wa-missing">To switch it on, save {st.missing.join(", ")}.</p>}
        {st.source === "environment" && <p className="mt-2 rounded-lg bg-brand-goldLight p-3 text-sm text-brand-goldText">Some details are coming from the server&apos;s environment settings. Anything you save here takes over.</p>}
        {!st.canStoreSecrets && <p className="mt-2 text-sm text-brand-rose" role="alert">This server cannot store credentials safely (AUTH_SECRET is missing or too short), so saving is disabled.</p>}
      </Card>

      <Card className="mt-3">
        <h3 className="font-semibold text-brand-ink">Credentials from Meta</h3>
        <form className="mt-2 grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={(e) => { e.preventDefault(); void send({ action: "save", ...f }, "Saved.").then((ok) => { if (ok) setF({ accessToken: "", phoneNumberId: "", appSecret: "", templateLang: "" }); }); }}>
          <label className="block text-sm sm:col-span-2"><span className="font-semibold text-brand-ink">Access token</span> {st.accessToken.set ? <Badge variant="success">Saved {st.accessToken.hint}</Badge> : <Badge variant="neutral">Not saved</Badge>}
            <input type="password" autoComplete="new-password" spellCheck={false} data-testid="wa-token" className={input} value={f.accessToken} onChange={(e) => setF({ ...f, accessToken: e.target.value })} placeholder={st.accessToken.set ? "Paste a new one to replace it" : "Permanent access token"} />
          </label>
          <label className="block text-sm"><span className="font-semibold text-brand-ink">Phone number ID</span> {st.phoneNumberId ? <Badge variant="success">Saved</Badge> : <Badge variant="neutral">Not saved</Badge>}
            <input inputMode="numeric" autoComplete="off" data-testid="wa-phone" className={input} value={f.phoneNumberId} onChange={(e) => setF({ ...f, phoneNumberId: e.target.value })} placeholder={st.phoneNumberId ?? "Digits only"} />
          </label>
          <label className="block text-sm"><span className="font-semibold text-brand-ink">App secret</span> {st.appSecret.set ? <Badge variant="success">Saved {st.appSecret.hint}</Badge> : <Badge variant="neutral">Not saved</Badge>}
            <input type="password" autoComplete="new-password" spellCheck={false} data-testid="wa-secret" className={input} value={f.appSecret} onChange={(e) => setF({ ...f, appSecret: e.target.value })} placeholder={st.appSecret.set ? "Paste a new one to replace it" : "From the Meta app's settings"} />
          </label>
          <label className="block text-sm"><span className="font-semibold text-brand-ink">Template language</span>
            <input autoComplete="off" data-testid="wa-lang" className={input} value={f.templateLang} onChange={(e) => setF({ ...f, templateLang: e.target.value })} placeholder={`${st.templateLang} (the language your approved templates were written in)`} />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={busy || !filled || !st.canStoreSecrets} className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="wa-save">Save</button>
            <button type="button" disabled={busy || !st.accessToken.set || !st.phoneNumberId} className={btn} onClick={() => void send({ action: "test" })} data-testid="wa-test">Test connection</button>
            <button type="button" disabled={busy || (!st.accessToken.set && !st.phoneNumberId && !st.appSecret.set)} className="min-h-[44px] rounded-full border border-brand-rose px-4 text-sm font-semibold text-brand-rose hover:bg-brand-roseLight disabled:opacity-60" data-testid="wa-clear" onClick={() => { if (window.confirm("Forget every saved WhatsApp credential and switch WhatsApp off?")) void send({ action: "clear" }, "Credentials removed."); }}>Remove credentials</button>
          </div>
        </form>
        {problem && <p className="mt-2 text-sm text-brand-rose" role="alert" data-testid="wa-problem">{problem}</p>}
        {test && (test.ok
          ? <p className="mt-2 text-sm text-brand-ink" role="status" data-testid="wa-test-result"><Badge variant="success">Connected</Badge> {test.verifiedName ?? "Your business"}{test.displayNumber ? `, number ${test.displayNumber}` : ""}. Nothing was sent.</p>
          : <p className="mt-2 text-sm text-brand-rose" role="alert" data-testid="wa-test-result">Meta said: {test.error}</p>)}
      </Card>

      <Card className="mt-3">
        <h3 className="font-semibold text-brand-ink">Webhook, for delivery receipts and STOP replies</h3>
        <p className="mt-1 text-sm text-gray-600">In the Meta app&apos;s WhatsApp settings, set the callback URL and verify token to these, and subscribe to the &quot;messages&quot; field.</p>
        <dl className="mt-2 space-y-2 text-sm">
          <div><dt className="font-semibold text-brand-ink">Callback URL</dt><dd className="flex flex-wrap items-center gap-2"><span className="break-all text-brand-ink" data-testid="wa-url">{st.webhookUrl}</span><button type="button" className={btn} onClick={() => copy("url", st.webhookUrl)}>{copied === "url" ? "Copied" : "Copy"}</button></dd></div>
          <div><dt className="font-semibold text-brand-ink">Verify token</dt><dd className="flex flex-wrap items-center gap-2">
            {st.verifyToken ? <><span className="break-all text-brand-ink" data-testid="wa-verify">{st.verifyToken}</span><button type="button" className={btn} onClick={() => copy("verify", st.verifyToken ?? "")}>{copied === "verify" ? "Copied" : "Copy"}</button></> : <span className="text-gray-600">None yet. It is made for you when you switch WhatsApp on, or make one now.</span>}
            <button type="button" disabled={busy || !st.canStoreSecrets} className={btn} data-testid="wa-gen" onClick={() => void send({ action: "generateVerifyToken" }, "New verify token made. Paste it into Meta.")}>{st.verifyToken ? "Make a new one" : "Make one"}</button>
          </dd></div>
        </dl>
        <p className="mt-3 text-sm text-gray-600">Not yet tested against Meta itself: it has only been tried against a stand-in. Use &quot;Test connection&quot;, then send one message to your own number before turning on the follow-ups.</p>
      </Card>
    </section>
  );
}

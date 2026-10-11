"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { INDUSTRIES, STAGES, STAGE_LABEL } from "@/lib/startups/startupCore";

const STEPS = ["About you", "Your startup", "Check and create"] as const;
interface Data { name: string; email: string; password: string; confirm: string; phone: string; consent: boolean; sName: string; tagline: string; industry: string; stage: string; website: string; location: string; description: string }
const EMPTY: Data = { name: "", email: "", password: "", confirm: "", phone: "", consent: false, sName: "", tagline: "", industry: "", stage: "IDEA", website: "", location: "", description: "" };
const SELECT = "min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink focus:border-brand-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal";

/** What is wrong on a step, in plain words, or null. The server checks everything again; this is only to help the person sooner. */
function problem(step: number, d: Data): string | null {
  if (step === 0) {
    if (!d.name.trim()) return "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(d.email.trim())) return "Enter a valid email address.";
    if (d.password.length < 8) return "Choose a password of at least 8 characters.";
    if (d.password !== d.confirm) return "The two passwords do not match.";
    if (!d.consent) return "Please agree to the Privacy Policy to continue.";
  }
  if (step === 1) {
    if (d.sName.trim().length < 2) return "Give the startup a name.";
    if (d.website.trim() && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(d.website.trim())) return "Enter the full web address, starting with http:// or https://";
  }
  return null;
}

/** The founder sign-up in three steps. Entries are kept while moving between steps; the account kind is not something this form sends. */
export default function StartupRegisterForm() {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Data>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ startupId: string | null; startupProblem: boolean } | null>(null);
  const sending = useRef(false);
  const set = <K extends keyof Data>(k: K, v: Data[K]) => setD((x) => ({ ...x, [k]: v }));

  function next() {
    const p = problem(step, d);
    if (p) return setError(p);
    setError(null);
    setStep((s) => s + 1);
  }

  async function submit() {
    if (sending.current) return; // a second tap while the first is on its way does nothing
    for (const s of [0, 1]) { const p = problem(s, d); if (p) { setStep(s); return setError(p); } }
    sending.current = true; setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/startup-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: d.name.trim(), email: d.email.trim(), password: d.password, phone: d.phone.trim() || undefined, privacyConsent: d.consent,
          startup: { name: d.sName.trim(), tagline: d.tagline.trim() || undefined, industry: d.industry || undefined, stage: d.stage, website: d.website.trim() || undefined, location: d.location.trim() || undefined, description: d.description.trim() || undefined },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "We could not create your account. Please try again."); return; }
      setDone({ startupId: body.startupId ?? null, startupProblem: !!body.startupProblem });
    } catch {
      setError("We could not reach the server. Check your connection and press Create again; nothing has been lost.");
    } finally {
      sending.current = false; setBusy(false);
    }
  }

  if (done) {
    const to = done.startupId ? `/trainee/startups/${done.startupId}` : "/trainee/startups";
    return (
      <Card>
        <h2 className="font-display text-xl font-semibold text-brand-ink">Check your email</h2>
        <p className="mt-2 text-sm text-gray-800">We sent a link to <span className="font-semibold">{d.email.trim()}</span>. Open it to verify your address.</p>
        {done.startupProblem
          ? <p role="status" className="mt-2 text-sm text-brand-goldText">Your account is ready, but we could not save the startup. After signing in, add it from My Startups.</p>
          : <p className="mt-2 text-sm text-gray-800">Your startup <span className="font-semibold">{d.sName.trim()}</span> is saved as a draft. Sign in, finish its profile (tagline, the problem, your solution and its industry) and send it for review. It becomes public once the AAICBI team approves it.</p>}
        <Link href={`/trainee/login?next=${encodeURIComponent(to)}`} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand-teal px-5 text-sm font-semibold text-brand-onAccent hover:bg-brand-tealDeep">Sign in and finish the startup</Link>
      </Card>
    );
  }

  return (
    <Card>
      <ol aria-label="Progress" className="mb-5 flex gap-2 text-xs font-semibold">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined} className={`flex-1 rounded-full px-3 py-1.5 text-center ${i === step ? "bg-brand-teal text-brand-onAccent" : i < step ? "bg-brand-mint text-brand-tealDeep" : "bg-brand-gray/40 text-gray-700"}`}>{i + 1}. {s}</li>)}
      </ol>
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (step < 2) next(); else void submit(); }} className="space-y-4">
        {step === 0 && (
          <>
            <Input label="Your full name" autoComplete="name" value={d.name} onChange={(e) => set("name", e.target.value)} required />
            <Input label="Email address" type="email" autoComplete="email" value={d.email} onChange={(e) => set("email", e.target.value)} required />
            <Input label="Password" type="password" autoComplete="new-password" hint="At least 8 characters." value={d.password} onChange={(e) => set("password", e.target.value)} required />
            <Input label="Confirm password" type="password" autoComplete="new-password" value={d.confirm} onChange={(e) => set("confirm", e.target.value)} required />
            <Input label="Phone number (optional)" type="tel" autoComplete="tel" inputMode="tel" value={d.phone} onChange={(e) => set("phone", e.target.value)} />
            <label className="flex items-start gap-2 text-sm text-gray-800"><input type="checkbox" checked={d.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1 h-4 w-4" /><span>I have read and agree to the <Link href="/privacy-policy" target="_blank" className="font-semibold text-brand-teal hover:underline">Privacy Policy</Link>.</span></label>
          </>
        )}
        {step === 1 && (
          <>
            <Input label="Startup name" value={d.sName} onChange={(e) => set("sName", e.target.value)} required />
            <Input label="One-line tagline (optional)" maxLength={120} value={d.tagline} onChange={(e) => set("tagline", e.target.value)} />
            <div><label htmlFor="su-industry" className="mb-1 block text-sm font-semibold text-brand-ink">Industry (optional)</label><select id="su-industry" className={SELECT} value={d.industry} onChange={(e) => set("industry", e.target.value)}><option value="">Choose later</option>{INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}</select></div>
            <div><label htmlFor="su-stage" className="mb-1 block text-sm font-semibold text-brand-ink">Stage</label><select id="su-stage" className={SELECT} value={d.stage} onChange={(e) => set("stage", e.target.value)}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></div>
            <Input label="Website or project link (optional)" type="url" inputMode="url" placeholder="https://" value={d.website} onChange={(e) => set("website", e.target.value)} />
            <Input label="Location (optional)" value={d.location} onChange={(e) => set("location", e.target.value)} />
            <div><label htmlFor="su-desc" className="mb-1 block text-sm font-semibold text-brand-ink">What does it do? (optional)</label><textarea id="su-desc" rows={4} maxLength={2000} className={`${SELECT} py-2`} value={d.description} onChange={(e) => set("description", e.target.value)} /><p className="mt-1 text-xs text-gray-700">This becomes public after approval. Do not include anything confidential.</p></div>
          </>
        )}
        {step === 2 && (
          <dl className="space-y-3 text-sm">
            <div><dt className="font-semibold text-gray-700">You</dt><dd className="text-brand-ink">{d.name} · {d.email}</dd></div>
            <div><dt className="font-semibold text-gray-700">Startup</dt><dd className="text-brand-ink">{d.sName}{d.tagline ? ` · ${d.tagline}` : ""}</dd><dd className="text-gray-700">{[d.industry, STAGE_LABEL[d.stage as keyof typeof STAGE_LABEL], d.location].filter(Boolean).join(" · ")}</dd></div>
            <p className="text-gray-800">This creates your founder account and a draft startup. Nothing is public yet: you will finish the profile and send it for review after you verify your email.</p>
          </dl>
        )}
        {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
        <div className="flex items-center justify-between gap-3 pt-1">
          {step > 0 ? <Button type="button" variant="ghost" onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={busy}>Back</Button> : <span />}
          <Button type="submit" loading={busy} className="min-w-[10rem]">{step < 2 ? "Continue" : busy ? "Creating…" : "Create Startup account"}</Button>
        </div>
      </form>
      <p className="mt-4 text-center text-xs text-gray-700">Already registered? <Link href="/login" className="font-semibold text-brand-teal hover:underline">Log in</Link></p>
    </Card>
  );
}

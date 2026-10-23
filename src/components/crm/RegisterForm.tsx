"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/Field";
import { COUNTRIES, NG_STATES } from "@/lib/crm/places";

interface Props {
  courseId: string;
  courseTitle: string;
  agreement: { version: number; title: string; body: string };
  src: string | null;
  play: string | null;
  prefill: { email: string; phone: string };
}

type Fields = { firstName: string; lastName: string; email: string; phone: string; country: string; state: string; motivation: string };
const EMPTY: Fields = { firstName: "", lastName: "", email: "", phone: "", country: "Nigeria", state: "", motivation: "" };

/**
 * The public registration form. Details are kept in this browser as a draft (never the signature or the ticks), so an interrupted or failed
 * submission loses nothing. The signature and both ticks are always typed fresh.
 */
export default function RegisterForm({ courseId, courseTitle, agreement, src, play, prefill }: Props) {
  const router = useRouter();
  const draftKey = `crm-register-draft:${courseId}`;
  const [f, setF] = useState<Fields>({ ...EMPTY, email: prefill.email, phone: prefill.phone });
  const [signed, setSigned] = useState("");
  const [agree, setAgree] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const opened = useRef<number>(Date.now());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) setF((cur) => ({ ...cur, ...(JSON.parse(raw) as Partial<Fields>), ...(prefill.email ? { email: prefill.email } : {}), ...(prefill.phone ? { phone: prefill.phone } : {}) }));
    } catch { /* a blocked or empty store is fine */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(f)); } catch { /* ignore */ }
  }, [f, draftKey]);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const ready = useMemo(() => signed.trim().length >= 3 && agree && followUp && f.firstName.trim() && f.lastName.trim() && f.email.trim() && f.phone.trim(), [signed, agree, followUp, f]);
  const states = f.country === "Nigeria";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErrors({}); setMessage(null);
    try {
      const res = await fetch(`/api/public/register/${encodeURIComponent(courseId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, agreementVersion: agreement.version, agreementAccepted: agree, signedName: signed, followUp, newsletter, website, openedForMs: Date.now() - opened.current, src, play }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors((data.fields as Record<string, string>) ?? {});
        setMessage(data.error ?? "We could not save your registration. Your details are still here. Please try again.");
        setBusy(false);
        return;
      }
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      router.push(`/register/${encodeURIComponent(courseId)}/done?ref=${encodeURIComponent(data.reference)}`);
    } catch {
      setMessage("We could not reach the server. Your details are still here. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4" aria-describedby={message ? "reg-msg" : undefined} data-testid="register-form">
      <h2 className="font-display text-xl font-bold text-brand-ink">Your details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="First name" required autoComplete="given-name" value={f.firstName} onChange={set("firstName")} error={errors.firstName} />
        <Input label="Last name" required autoComplete="family-name" value={f.lastName} onChange={set("lastName")} error={errors.lastName} />
      </div>
      <Input label="Email" type="email" required autoComplete="email" value={f.email} onChange={set("email")} error={errors.email} />
      <Input label="WhatsApp number" type="tel" required autoComplete="tel" value={f.phone} onChange={set("phone")} error={errors.phone} hint="Include the country code, like +234 801 234 5678." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Country" required value={f.country} onChange={(e) => setF((cur) => ({ ...cur, country: e.target.value, state: "" }))} error={errors.country}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {states ? (
          <Select label="State" value={f.state} onChange={set("state")} error={errors.state}>
            <option value="">Choose your state</option>
            {NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        ) : (
          <Input label="State or region" value={f.state} onChange={set("state")} error={errors.state} />
        )}
      </div>
      <Textarea label="Why do you want to join? (optional)" rows={3} maxLength={600} value={f.motivation} onChange={set("motivation")} error={errors.motivation} />

      <h2 className="mt-2 font-display text-xl font-bold text-brand-ink">{agreement.title}</h2>
      <div tabIndex={0} role="region" aria-label="Agreement text" className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl border border-brand-gray bg-brand-surface p-3 text-sm text-brand-ink" data-testid="agreement-text">
        {agreement.body}
      </div>
      <Input label="Type your full name to sign" required autoComplete="off" value={signed} onChange={(e) => setSigned(e.target.value)} error={errors.signedName} hint="Typing your name and ticking below has the same effect as signing." />
      <Checkbox required checked={agree} onChange={(e) => setAgree(e.target.checked)} label="I have read and agree to the agreement above." />
      {errors.agreementAccepted && <p role="alert" className="text-sm text-brand-rose">{errors.agreementAccepted}</p>}
      <Checkbox required checked={followUp} onChange={(e) => setFollowUp(e.target.checked)} label="Contact me by email and WhatsApp about this course. I can stop at any time." />
      {errors.followUp && <p role="alert" className="text-sm text-brand-rose">{errors.followUp}</p>}
      <Checkbox checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} label="Optional: send me news and offers about other AAICBI courses." />

      <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {message && <p id="reg-msg" role="alert" className="rounded-xl border border-brand-rose/40 bg-brand-surface p-3 text-sm text-brand-rose">{message}</p>}
      <Button type="submit" size="lg" disabled={!ready || busy} data-testid="register-submit">{busy ? "Saving…" : `Register for ${courseTitle}`}</Button>
      {!ready && <p className="text-sm text-brand-ink/80">Fill in your details, sign the agreement and tick the follow-up box to continue.</p>}
    </form>
  );
}

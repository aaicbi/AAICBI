"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
/**
 * Training Organizations, Phase 1 — mirrors employer/register/page.tsx's
 * exact shape. No "check your email" step, same reasoning as the
 * Employer page: approval, not email verification, is this account
 * type's real gate — and this one goes further, refusing login
 * entirely (not just gating features) until approved.
 */
export default function TrainingOrgRegisterPage() {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  // Direct platform-fee billing — just a stated preference for
  // SUPER_ADMIN to act on during review; no price is shown or collected
  // here (see training-org-register's own comment).
  const [billingModel, setBillingModel] = useState<"REVENUE_SHARE" | "DIRECT_PAYMENT">("REVENUE_SHARE");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/training-org-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contactName, email, password, phone, website, billingModel }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Registration failed.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-xl font-semibold text-brand-ink">Application received</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your account is pending review. We&apos;ll email you once it&apos;s approved — you won&apos;t be able to
            sign in until then.
          </p>
          <Button href="/org/login" className="mt-5">
            Go to Login
          </Button>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Register Your Training Organization</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every organization account is reviewed before it can run training on AAICBI.
        </p>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Organization name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Your name" value={contactName} onChange={(e) => setContactName(e.target.value)} required />
            <Input label="Work email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

            <p className="pt-2 text-xs font-semibold text-gray-400">How would you like to work with AAICBI?</p>
            <div className="space-y-2 rounded-lg border border-brand-gray p-3">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="billingModel"
                  checked={billingModel === "REVENUE_SHARE"}
                  onChange={() => setBillingModel("REVENUE_SHARE")}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold text-brand-ink">Revenue share</span> — no upfront cost; AAICBI takes
                  a percentage of what your trainees pay you.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="billingModel"
                  checked={billingModel === "DIRECT_PAYMENT"}
                  onChange={() => setBillingModel("DIRECT_PAYMENT")}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-semibold text-brand-ink">Pay AAICBI directly</span> — a fixed platform fee;
                  you keep 100% of what your trainees pay you.
                </span>
              </label>
              <p className="text-xs text-gray-500">
                Pricing is agreed with AAICBI after your application is reviewed — nothing is charged here.
              </p>
            </div>

            <p className="pt-2 text-xs font-semibold text-gray-400">Optional — strengthens your review, not required</p>
            <Input label="Phone number (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Organization website (optional)" type="url" value={website} onChange={(e) => setWebsite(e.target.value)} />

            {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Register
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a href="/org/login" className="font-semibold text-brand-teal hover:underline">
            Log in
          </a>
        </p>
      </main>
    </>
  );
}

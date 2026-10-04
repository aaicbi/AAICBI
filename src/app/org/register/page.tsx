"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
      body: JSON.stringify({ name, contactName, email, password, phone, website }),
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
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              aria-label="Organization name"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              aria-label="Work email"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />

            <p className="pt-2 text-xs font-semibold text-gray-400">Optional — strengthens your review, not required</p>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number (optional)"
              aria-label="Phone number (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Organization website (optional)"
              aria-label="Organization website (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />

            {error && <p className="text-sm text-brand-rose">{error}</p>}
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

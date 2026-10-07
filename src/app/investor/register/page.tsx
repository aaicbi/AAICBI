"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
/**
 * Pitch & Post, Phase 2 — mirrors /employer/register's exact shape:
 * no "check your email" step, since approval (not email verification)
 * is this account type's real gate too.
 */
export default function InvestorRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/investor-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, organization, phone, linkedinUrl }),
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
            Your account is pending review. We&apos;ll let you know once it&apos;s approved — you can check back here any time by logging in.
          </p>
          <Button href="/investor/login" className="mt-5">
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
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Register as an Investor</h1>
        <p className="mt-1 text-sm text-gray-500">Every investor account is reviewed before it can browse pitches.</p>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <Input label="Organization" value={organization} onChange={(e) => setOrganization(e.target.value)} required />

            <p className="pt-2 text-xs font-semibold text-gray-400">Optional — strengthens your review, not required</p>
            <Input label="Phone (optional)" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="LinkedIn URL (optional)" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} />

            {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Register
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a href="/investor/login" className="font-semibold text-brand-teal hover:underline">
            Log in
          </a>
        </p>
      </main>
    </>
  );
}

"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * M31 — no "check your email" step here, unlike trainee registration:
 * approval, not email verification, is this account type's real gate.
 * Landing directly on the pending-status page after registering is
 * genuinely more honest than implying an email confirmation matters
 * here when it doesn't.
 */
export default function EmployerRegisterPage() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [otherSocialUrl, setOtherSocialUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/employer-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName,
        contactName,
        email,
        password,
        registrationNumber,
        phone,
        website,
        linkedinUrl,
        otherSocialUrl,
      }),
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
            Your account is pending review. We&apos;ll let you know once it&apos;s approved — you can check back
            here any time by logging in.
          </p>
          <Button href="/employer/login" className="mt-5">
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
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Register as an Employer</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every employer account is reviewed before it can browse trainees or post a vacancy.
        </p>
        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company name"
              aria-label="Company name"
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
            <input
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              placeholder="Business registration number"
              aria-label="Business registration number"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Company phone number"
              aria-label="Company phone number"
              required
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />

            <p className="pt-2 text-xs font-semibold text-gray-400">Optional — strengthens your review, not required</p>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Company website (optional)"
              aria-label="Company website (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="LinkedIn company page (optional)"
              aria-label="LinkedIn company page (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />
            <input
              type="url"
              value={otherSocialUrl}
              onChange={(e) => setOtherSocialUrl(e.target.value)}
              placeholder="Other social/online presence (optional)"
              aria-label="Other social or online presence (optional)"
              className="w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
            />

            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Register
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account? <a href="/employer/login" className="font-semibold text-brand-teal hover:underline">Log in</a>
        </p>
      </main>
    </>
  );
}

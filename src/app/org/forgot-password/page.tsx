"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

/** A training organization's owner or teammate asks for a reset link. The answer never says whether the address has an account. */
export default function OrgForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/training-org-forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setLoading(false);
    if (res.status === 429) { setError("Too many requests. Please try again later."); return; }
    setSubmitted(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <h1 className="text-center font-display text-xl font-semibold text-brand-ink">Reset your organization password</h1>
        {submitted ? (
          <Card className="mt-6 text-sm text-gray-600" data-testid="org-forgot-sent">
            If an account exists for that email, we&apos;ve sent a password reset link. Check your inbox and spam folder. The link works for one hour.
          </Card>
        ) : (
          <Card className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Email" type="email" autoComplete="username" hint="The address you sign in with, as the owner or as a team member." value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">{loading ? "Sending..." : "Send reset link"}</Button>
            </form>
          </Card>
        )}
        <p className="mt-4 text-center text-xs text-gray-500">
          <a href="/org/login" className="text-brand-teal hover:underline">Back to sign in</a>
        </p>
      </main>
    </>
  );
}

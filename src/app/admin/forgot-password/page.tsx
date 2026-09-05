"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Design-pass fix: the submitted-state message still said "Email
 * delivery isn't wired up yet in this scaffold — a developer can read
 * the token directly from the database" — the fourth page carrying
 * this exact stale claim (after the trainee dashboard, registration,
 * and forgot-password screens), false since M14 shipped a real staff
 * password-reset email too.
 */
export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    // Same message shown whether or not the account exists — see the
    // API route's comment for why: this page must not become a way to
    // check which emails are registered.
    setSubmitted(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <h1 className="text-center font-display text-xl font-semibold text-brand-ink">Reset Your Password</h1>

        {submitted ? (
          <Card className="mt-6 text-sm text-gray-600">
            If an account exists for that email, we&apos;ve sent a password reset link — check your inbox (and
            spam folder) for it.
          </Card>
        ) : (
          <Card className="mt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-brand-ink">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
                />
              </div>
              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </Card>
        )}

        <p className="mt-4 text-center text-xs text-gray-500">
          <a href="/admin/login" className="text-brand-teal hover:underline">
            Back to Sign In
          </a>
        </p>
      </main>
    </>
  );
}

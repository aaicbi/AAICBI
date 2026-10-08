"use client";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
/**
 * Pitch & Post — self-registration (Phase 2) and admin-direct-creation
 * (Phase 1, see /admin/investors) both land here; either way the
 * account works the same way once approved.
 */
export default function InvestorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/investor-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Invalid email or password.");
      return;
    }
    window.location.href = "/investor/dashboard";
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <div className="flex justify-center">
          <Logo href={null} compact markClassName="h-12 w-12" />
        </div>
        <h1 className="mt-4 text-center font-display text-xl font-semibold text-brand-ink">Investor Sign In</h1>

        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          New here?{" "}
          <a href="/investor/register" className="text-brand-teal hover:underline">
            Register as an investor
          </a>
        </p>
      </main>
    </>
  );
}

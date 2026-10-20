"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export default function OrgResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <OrgResetPasswordForm />
    </Suspense>
  );
}

/** Opened from the reset email: choose a new password for the organization owner or teammate. */
function OrgResetPasswordForm() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError("This link is missing its reset code. Open the link from your email again."); return; }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/training-org-reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not reset your password. Try again.");
      return;
    }
    setDone(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        {done ? (
          <div className="text-center" data-testid="org-reset-done">
            <h1 className="font-display text-xl font-semibold text-brand-ink">Password changed</h1>
            <p className="mt-2 text-sm text-gray-600">You can now sign in with your email and the new password.</p>
            <Button href="/org/login" className="mt-5">Go to sign in</Button>
          </div>
        ) : (
          <>
            <h1 className="text-center font-display text-xl font-semibold text-brand-ink">Choose a new password</h1>
            <Card className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="New password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p role="alert" className="text-sm text-brand-rose">{error}</p>}
                <Button type="submit" loading={loading} className="w-full">{loading ? "Saving..." : "Save new password"}</Button>
              </form>
            </Card>
            <p className="mt-4 text-center text-xs text-gray-500">
              <a href="/org/forgot-password" className="text-brand-teal hover:underline">Ask for a new link</a>
            </p>
          </>
        )}
      </main>
    </>
  );
}

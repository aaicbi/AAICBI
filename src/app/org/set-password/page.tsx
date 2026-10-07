"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

export default function OrgSetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <OrgSetPasswordForm />
    </Suspense>
  );
}

/** A teammate's first step: choose a password from the emailed invitation. */
function OrgSetPasswordForm() {
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This link is missing its invitation code. Open the link from your email again.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/training-org-member-set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not set your password. Try again.");
      return;
    }
    setDone(true);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        {done ? (
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold text-brand-ink">Password saved</h1>
            <p className="mt-2 text-sm text-gray-600">You can now sign in with your email and this password.</p>
            <Button href="/org/login" className="mt-5">
              Go to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-center font-display text-xl font-semibold text-brand-ink">Set your password</h1>
            <Card className="mt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  hint="At least 8 characters."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && (
                  <p role="alert" className="text-sm text-brand-rose">
                    {error}
                  </p>
                )}
                <Button type="submit" loading={loading} className="w-full">
                  {loading ? "Saving..." : "Save password"}
                </Button>
              </form>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

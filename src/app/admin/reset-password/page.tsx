"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

function AdminResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This link is missing a reset token.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not reset your password.");
      return;
    }
    setDone(true);
  }

  return done ? (
    <Card className="mt-6 text-center">
      <p className="text-sm text-gray-600">Your password has been updated.</p>
      <Button onClick={() => router.push("/admin/login")} className="mt-4">
        Sign In
      </Button>
    </Card>
  ) : (
    <Card className="mt-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-brand-ink">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
          />
        </div>
        {error && <p className="text-sm text-brand-rose">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">
          {loading ? "Saving..." : "Reset Password"}
        </Button>
      </form>
    </Card>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6">
        <h1 className="text-center font-display text-xl font-semibold text-brand-ink">Choose a New Password</h1>
        <Suspense fallback={<div className="mt-6 text-center text-sm text-gray-500">Loading...</div>}>
          <AdminResetPasswordForm />
        </Suspense>
      </main>
    </>
  );
}

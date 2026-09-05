"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import Logo from "@/components/Logo";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

export default function TraineeRegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [freeCourses, setFreeCourses] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // M24 — genuinely public, no auth required, since this page runs
  // before anyone has an account. Best-effort: if this fails, the
  // course selector just doesn't appear, which is a fine degradation
  // for something entirely optional — never blocks registration
  // itself either way.
  useEffect(() => {
    fetch("/api/courses/public-free")
      .then((r) => (r.ok ? r.json() : []))
      .then(setFreeCourses)
      .catch(() => setFreeCourses([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!privacyConsent) {
      setError("You must agree to the Privacy Policy to create an account.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, privacyConsent, courseId: courseId || undefined }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Registration failed.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col items-center justify-center px-6 text-center">
          <GrowthPathDoodle className="h-24 w-24" />
          <h1 className="mt-2 font-display text-xl font-semibold text-brand-ink">Check your email</h1>
          <p className="mt-3 text-sm text-gray-600">
            Your account has been created. We&apos;ve sent a verification link to your email address — click it to
            activate your account, then{" "}
            <a href="/trainee/login" className="text-brand-teal hover:underline">
              sign in
            </a>
            . Didn&apos;t get it? Check your spam folder, or ask an admin for help.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-sm flex-col justify-center px-6 py-10">
        <div className="flex justify-center">
          <Logo href={null} compact markClassName="h-12 w-12" />
        </div>
        <h1 className="mt-4 text-center font-display text-xl font-semibold text-brand-ink">Create Your Account</h1>

        <Card className="mt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-brand-ink">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
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
            <div>
              <label className="text-sm font-semibold text-brand-ink">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
              />
            </div>
            {freeCourses.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-brand-ink">Start a free course now? (optional)</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-brand-gray px-3 py-2.5 outline-none focus:border-brand-teal"
                >
                  <option value="">Not right now</option>
                  {freeCourses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-start gap-2">
              <input
                id="privacyConsent"
                type="checkbox"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
                required
                className="mt-1 h-4 w-4 shrink-0 rounded border-brand-gray text-brand-teal focus:ring-brand-teal"
              />
              <label htmlFor="privacyConsent" className="text-xs text-gray-600">
                I have read and agree to AAICBI&apos;s{" "}
                <a href="/privacy-policy" target="_blank" className="text-brand-teal hover:underline">
                  Privacy Policy
                </a>
                , including how my name, email, and course activity are collected and used.
              </label>
            </div>
            {error && <p className="text-sm text-brand-rose">{error}</p>}
            <Button type="submit" loading={loading} disabled={!privacyConsent} className="w-full">
              {loading ? "Creating account..." : "Create account"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-gray-500">
          Already have an account?{" "}
          <a href="/trainee/login" className="text-brand-teal hover:underline">
            Sign in
          </a>
        </p>
      </main>
    </>
  );
}

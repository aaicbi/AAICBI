"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";

/**
 * "Change password" for a signed-in trainee or training organization. It asks for the current password first,
 * then the new one twice. `apiPath` is the endpoint for that kind of account.
 */
export default function ChangePasswordCard({ apiPath }: { apiPath: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (next !== again) { setMessage({ ok: false, text: "The two new passwords do not match." }); return; }
    setBusy(true);
    const res = await fetch(apiPath, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: current, newPassword: next }) }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setCurrent(""); setNext(""); setAgain("");
      setMessage({ ok: true, text: "Your password has been changed. Use the new one next time you sign in." });
      return;
    }
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setMessage({ ok: false, text: data?.error ?? "We could not change your password. Check your connection and try again." });
  }

  return (
    <Card>
      <p className="font-display font-semibold text-brand-ink">Change password</p>
      <p className="mt-1 text-sm text-gray-600">Choose a password you do not use anywhere else. If you have forgotten your current one, sign out and use “Forgot your password?” on the sign-in page.</p>
      <form onSubmit={submit} className="mt-3 max-w-sm space-y-3" data-testid="change-password">
        <Input label="Current password" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="New password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label="New password again" type="password" autoComplete="new-password" minLength={8} required value={again} onChange={(e) => setAgain(e.target.value)} />
        {message && <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-brand-teal" : "text-brand-rose"}`}>{message.text}</p>}
        <Button type="submit" loading={busy}>{busy ? "Saving..." : "Change password"}</Button>
      </form>
    </Card>
  );
}

"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";

/**
 * Training Organizations, Phase 1 — the one client sliver on the
 * otherwise server-rendered template review page, same "one small
 * interactive piece on a static document" shape as
 * PrintCertificateButton.tsx. Posts to the single-use approve route;
 * a second click after success is simply disabled, and the route
 * itself is the real guard against a replayed/reopened link (see its
 * own comment).
 */
export default function ApproveTemplateButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/certificate-templates/review/${token}/approve`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not approve. Try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="text-sm font-semibold text-brand-teal">Approved — thank you!</p>;
  }

  return (
    <div>
      <Button onClick={approve} loading={loading}>
        Approve This Certificate
      </Button>
      {error && <p className="mt-2 text-sm text-brand-rose">{error}</p>}
    </div>
  );
}

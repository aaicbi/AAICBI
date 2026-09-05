"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AchievementDoodle from "@/components/doodles/AchievementDoodle";

/** M15 — the entry point for someone who has a certificate code but
 * not a direct link (e.g. typed it in from a printed certificate,
 * rather than scanning a QR or clicking an email link). Just a lookup
 * form that redirects to the actual verification page — all the real
 * logic lives there, this is purely a convenience front door. */
export default function CertificateLookupPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) router.push(`/certificate/${encodeURIComponent(trimmed)}`);
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <AchievementDoodle className="h-20 w-20" />
        <h1 className="mt-3 font-display text-xl font-semibold text-brand-ink">Verify a Certificate</h1>
        <p className="mt-2 text-sm text-gray-600">
          Enter the certificate code found on an AAICBI certificate to confirm it&apos;s genuine.
        </p>
        <Card className="mt-6 w-full text-left">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="AAICBI-XXXX-XXXX"
              aria-label="Certificate code"
              className="flex-1 rounded-lg border border-brand-gray px-3 py-2.5 text-sm uppercase tracking-wide focus:border-brand-teal focus:outline-none"
            />
            <Button type="submit" disabled={!code.trim()}>
              Verify
            </Button>
          </form>
        </Card>
      </main>
    </>
  );
}

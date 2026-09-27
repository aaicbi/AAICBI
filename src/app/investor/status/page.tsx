"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/investor/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface InvestorMe {
  name: string;
  organization: string;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
}

const STATUS_COPY: Record<InvestorMe["approvalState"], { title: string; body: string }> = {
  PENDING: {
    title: "Application under review",
    body: "We're reviewing your account. You'll be able to browse published pitches once it's approved.",
  },
  APPROVED: {
    title: "Account approved",
    body: "You can now browse published pitches from AAICBI's trainee founders.",
  },
  REJECTED: {
    title: "Application not approved",
    body: "Your account wasn't approved at this time. If you believe this is a mistake, please contact support.",
  },
};

/** Mirrors /employer/status's exact shape. */
export default function InvestorStatusPage() {
  const [me, setMe] = useState<InvestorMe | null>(null);

  useEffect(() => {
    fetch("/api/investor/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  return (
    <>
      <SiteHeader nav={me?.approvalState === "APPROVED" ? [{ label: "Investment Opportunities", href: "/investor/dashboard" }] : undefined} right={<LogoutButton />} />
      <main className="mx-auto max-w-md px-6 py-16">
        {me && (
          <>
            <h1 className="font-display text-xl font-semibold text-brand-ink">{me.name}</h1>
            <p className="text-sm text-gray-500">{me.organization}</p>
            <Card className="mt-6">
              {me.approvalState === "PENDING" && (
                <div className="mx-auto mb-3 h-20 w-20">
                  <GrowthPathDoodle className="h-full w-full" />
                </div>
              )}
              <p className="font-display font-semibold text-brand-ink">{STATUS_COPY[me.approvalState].title}</p>
              <p className="mt-1 text-sm text-gray-600">{STATUS_COPY[me.approvalState].body}</p>
              {me.approvalState === "APPROVED" && (
                <Button href="/investor/dashboard" className="mt-3">
                  View Investment Opportunities
                </Button>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}

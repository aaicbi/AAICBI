"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmployerOnboarding from "@/components/employer/EmployerOnboarding";
import GrowthPathDoodle from "@/components/doodles/GrowthPathDoodle";

interface EmployerMe {
  companyName: string;
  contactName: string;
  approvalState: "PENDING" | "APPROVED" | "REJECTED";
  onboardingCompletedAt: string | null;
}

const STATUS_COPY: Record<EmployerMe["approvalState"], { title: string; body: string }> = {
  PENDING: {
    title: "Application under review",
    body: "We're reviewing your account. You'll be able to browse trainees and reach out once it's approved.",
  },
  APPROVED: {
    title: "Account approved",
    body: "You can now browse discoverable trainees and reach out directly.",
  },
  REJECTED: {
    title: "Application not approved",
    body: "Your account wasn't approved at this time. If you believe this is a mistake, please contact support.",
  },
};

const NAV = [
  { label: "Discover", href: "/employer/discover" },
  { label: "My Introductions", href: "/employer/introductions" },
  { label: "Job Postings", href: "/employer/job-postings" },
  { label: "Account", href: "/employer/status" },
  { label: "Settings", href: "/employer/settings" },
];

export default function EmployerStatusPage() {
  const [me, setMe] = useState<EmployerMe | null>(null);

  useEffect(() => {
    fetch("/api/employer/me")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  return (
    <>
      {me?.approvalState === "APPROVED" && (
        <EmployerOnboarding shouldShow={!me.onboardingCompletedAt} />
      )}
      <SiteHeader nav={me?.approvalState === "APPROVED" ? NAV : undefined} right={<LogoutButton />} />
      <main className="mx-auto max-w-md px-6 py-16">
        {me && (
          <>
            <h1 className="font-display text-xl font-semibold text-brand-ink">{me.companyName}</h1>
            <p className="text-sm text-gray-500">{me.contactName}</p>
            <Card className="mt-6">
              {me.approvalState === "PENDING" && (
                <div className="mx-auto mb-3 h-20 w-20">
                  <GrowthPathDoodle className="h-full w-full" />
                </div>
              )}
              <p className="font-display font-semibold text-brand-ink">{STATUS_COPY[me.approvalState].title}</p>
              <p className="mt-1 text-sm text-gray-600">{STATUS_COPY[me.approvalState].body}</p>
              {me.approvalState === "APPROVED" && (
                <Button href="/employer/discover" className="mt-3">
                  Discover Trainees
                </Button>
              )}
            </Card>
          </>
        )}
      </main>
    </>
  );
}

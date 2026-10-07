"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/employer/LogoutButton";
import OrganizationDiscovery from "@/components/ecosystem/OrganizationDiscovery";
import { EMPLOYER_NAV, EMPLOYER_ORGANIZATIONS_NAV } from "@/lib/employer/nav";

export default function EmployerOrganizationsPage() {
  return (
    <>
      <SiteHeader nav={[...EMPLOYER_NAV, EMPLOYER_ORGANIZATIONS_NAV]} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Training organizations</h1>
        <p className="mt-1 text-sm text-gray-500">Find who trains for the skills you hire, then meet their trainees.</p>
        <div className="mt-4"><OrganizationDiscovery role="EMPLOYER" /></div>
      </main>
    </>
  );
}

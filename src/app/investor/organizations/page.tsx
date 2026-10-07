"use client";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/investor/LogoutButton";
import OrganizationDiscovery from "@/components/ecosystem/OrganizationDiscovery";
import { INVESTOR_NAV, INVESTOR_ORGANIZATIONS_NAV } from "@/lib/investor/nav";

export default function InvestorOrganizationsPage() {
  return (
    <>
      <SiteHeader nav={[...INVESTOR_NAV, INVESTOR_ORGANIZATIONS_NAV]} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Training organizations</h1>
        <p className="mt-1 text-sm text-gray-500">Organizations producing founders and talent. Watch the ones you want to follow.</p>
        <div className="mt-4"><OrganizationDiscovery role="INVESTOR" /></div>
      </main>
    </>
  );
}

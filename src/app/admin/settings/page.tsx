"use client";
import { useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import AccountSettingsPanel from "@/components/admin/AccountSettingsPanel";
import PaymentsSettingsPanel from "@/components/admin/PaymentsSettingsPanel";
import SecuritySettingsPanel from "@/components/admin/SecuritySettingsPanel";
import IntegrationsPanel from "@/components/admin/IntegrationsPanel";
import ContactAdminCard from "@/components/ContactAdminCard";
import { ADMIN_AREAS } from "@/lib/adminAreas";
import Icon from "@/components/ui/Icon";
import { User, CreditCard, Lock, Plug, Inbox, ArrowRight } from "lucide-react";
import { LoopIcon } from "@/components/icons/brand";
import type { LucideIcon } from "lucide-react";

type SectionId = "account" | "payments" | "security" | "integrations";

/**
 * Settings-page redesign — was a single flat page (M47's personal
 * account preferences, plus a grid of links to unrelated admin tools,
 * all with equal visual weight). Restructured into an actual category
 * shell: a settings sub-navigation (desktop: vertical list; mobile:
 * horizontal segmented tabs, same responsive-tabs-over-sidebar pattern
 * this app already uses elsewhere for narrow screens) over four real
 * categories.
 *
 * "Account" is every staff role's own preferences. The other three
 * (Payments, Security, Integrations) are SUPER_ADMIN-only and each
 * back real, previously-hardcoded-or-unreachable platform behavior —
 * nothing here is a placeholder: Payments covers the AI-credit grant
 * and default reminder schedule tied to the paid-enrollment lifecycle;
 * Security covers session length (session.ts) and the Q&A suspension
 * threshold (qaModeration.ts); Integrations is a read-only status view
 * of the real third-party services this app already talks to. See each
 * panel component for the specific fields and why they're real.
 *
 * "Admin Areas" (Employers, Job Postings, etc.) is kept as a visually
 * separate quick-links section below the settings panel, not folded
 * into the tab switcher — those are operational management tools, not
 * configuration, and presenting them as another "settings tab" would
 * misrepresent what they are.
 */
const SECTIONS: Array<{ id: SectionId; label: string; icon: LucideIcon; superAdminOnly?: boolean }> = [
  { id: "account", label: "Account", icon: User },
  { id: "payments", label: "Payments", icon: CreditCard, superAdminOnly: true },
  { id: "security", label: "Security", icon: Lock, superAdminOnly: true },
  { id: "integrations", label: "Integrations", icon: Plug, superAdminOnly: true },
];

export default function AdminSettingsPage() {
  const [section, setSection] = useState<SectionId>("account");
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRole(typeof data.role === "string" ? data.role : null))
      .catch(() => {});
  }, []);

  const visibleSections = SECTIONS.filter((s) => !s.superAdminOnly || role === "SUPER_ADMIN");

  return (
    <>
      <SiteHeader
        nav={[
          { label: "Examinations", href: "/admin/dashboard" },
          { label: "Courses", href: "/admin/courses" },
          { label: "My Profile", href: "/admin/profile" },
          { label: "Settings", href: "/admin/settings" },
        ]}
        right={<LogoutButton />}
      />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold text-brand-ink">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account and the platform-wide preferences you administer.
        </p>

        <div className="mt-8 flex flex-col gap-8 sm:flex-row">
          {/* Desktop: a vertical settings nav. Mobile: a horizontal
              segmented control — the same "sidebar becomes tabs below a
              breakpoint" reorganization the rest of this app already
              uses for narrow screens, not just a shrunk-down sidebar. */}
          <nav className="flex gap-2 overflow-x-auto pb-1 sm:w-48 sm:shrink-0 sm:flex-col sm:overflow-visible sm:pb-0">
            {visibleSections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                aria-current={section === s.id ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors sm:shrink ${
                  section === s.id
                    ? "bg-brand-mint text-brand-tealDeep"
                    : "text-gray-600 hover:bg-brand-mint/40 hover:text-brand-ink"
                }`}
              >
                <Icon icon={s.icon} size="sm" />
                {s.label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1">
            {section === "account" && <AccountSettingsPanel />}
            {section === "payments" && <PaymentsSettingsPanel viewerRole={role ?? undefined} />}
            {section === "security" && <SecuritySettingsPanel viewerRole={role ?? undefined} />}
            {section === "integrations" && <IntegrationsPanel viewerRole={role ?? undefined} />}
          </div>
        </div>

        {role === "SUPER_ADMIN" && (
          <div className="mt-10 flex flex-col gap-3">
            <a href="/admin/command" className="block">
              <div className="group flex items-center justify-between rounded-xl border border-brand-teal bg-brand-mint/40 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div>
                  <p className="flex items-center gap-1.5 font-display font-semibold text-brand-ink">
                    <Icon icon={LoopIcon} size="sm" /> AI Command Center
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Ask Loop about any trainee, employer, staff member, or cohort — it can only look things up and
                    report back, never change anything.
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-brand-teal transition-transform duration-200 group-hover:translate-x-0.5">
                  <Icon icon={ArrowRight} size="sm" />
                </span>
              </div>
            </a>
            <a href="/admin/inbox" className="block">
              <div className="group flex items-center justify-between rounded-xl border border-brand-gray bg-brand-surface p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-md">
                <div>
                  <p className="flex items-center gap-1.5 font-display font-semibold text-brand-ink">
                    <Icon icon={Inbox} size="sm" /> Admin Inbox
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Direct messages sent to you by trainees, employers, and staff.
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-brand-teal transition-transform duration-200 group-hover:translate-x-0.5">
                  <Icon icon={ArrowRight} size="sm" />
                </span>
              </div>
            </a>
          </div>
        )}

        {role && role !== "SUPER_ADMIN" && (
          <>
            <p className="mt-10 text-xs font-semibold uppercase tracking-wide text-gray-500">Support</p>
            <ContactAdminCard />
          </>
        )}

        <div className="mt-10 border-t border-brand-gray pt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Admin areas</p>
          <p className="mt-1 text-sm text-gray-500">Quick links to the other tools you administer.</p>
          <nav className="mt-3 grid gap-2 sm:grid-cols-2">
            {ADMIN_AREAS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-xl border border-brand-gray bg-brand-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-md"
              >
                <span>
                  <span className="block text-sm font-semibold text-brand-ink">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-gray-500">{item.desc}</span>
                </span>
                <span className="ml-3 text-brand-teal transition-transform duration-200 group-hover:translate-x-0.5">
                  <Icon icon={ArrowRight} size="sm" />
                </span>
              </a>
            ))}
          </nav>
        </div>
      </main>
    </>
  );
}

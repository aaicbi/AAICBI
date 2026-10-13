"use client";
import { useEffect, useState } from "react";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import CommandCenter from "@/components/command/CommandCenter";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/command — the Command Center, SUPER_ADMIN only: a Claude-style chat
 * with saved conversations, streaming Markdown replies, file attachments and a
 * level that sets how much Loop does on its own. The chat itself is in
 * components/command/CommandCenter.tsx; the engine and its rules are in
 * lib/loop/ (engine.ts, actions.ts, policy.ts).
 */
export default function CommandCenterPage() {
  const [role, setRole] = useState<string | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRole(typeof data.role === "string" ? data.role : null))
      .catch(() => setRole(null))
      .finally(() => setRoleChecked(true));
  }, []);

  if (roleChecked && role !== "SUPER_ADMIN") {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Command</p>
            <p className="mt-2 text-sm text-gray-600">
              Only Super Admins can use the Command Center. If you need something looked up, ask a Super Admin on your team.
            </p>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="mx-auto w-full max-w-7xl px-0 py-0 sm:px-4 sm:py-4">
        <DesktopRecommended what="The Command Center" />
        {role === "SUPER_ADMIN" ? <CommandCenter /> : <p className="px-6 py-10 text-sm text-gray-500">Loading…</p>}
      </main>
    </>
  );
}

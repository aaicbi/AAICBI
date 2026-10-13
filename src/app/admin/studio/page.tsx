"use client";
import { useEffect, useState } from "react";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Studio from "@/components/studio/Studio";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/studio — the Game Studio, Super Admin only. One page where games are
 * created, written with Loop, previewed exactly as trainees will play them,
 * and assigned to modules. See docs/game-studio.md.
 */
export default function StudioPage() {
  const [role, setRole] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRole(typeof d.role === "string" ? d.role : null))
      .catch(() => setRole(null))
      .finally(() => setChecked(true));
  }, []);

  if (checked && role !== "SUPER_ADMIN") {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Game Studio</p>
            <p className="mt-2 text-sm text-gray-600">Only Super Admins can use the Game Studio for now. Instructors can set up practice for their own modules from the module&apos;s assessment page.</p>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-4">
        <DesktopRecommended what="The Game Studio" />
        <h1 className="sr-only">Game Studio</h1>
        {role === "SUPER_ADMIN" ? <Studio /> : <p className="px-3 py-10 text-sm text-gray-500">Loading…</p>}
      </main>
    </>
  );
}

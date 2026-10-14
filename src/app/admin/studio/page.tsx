"use client";
import { useEffect, useState } from "react";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import Studio from "@/components/studio/Studio";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/studio — the Game Studio. A Super Admin sees everything; admins, instructors and organization staff see only
 * their own courses and games, and Loop is limited to those and to the level a Super Admin has granted them. One page where games are
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

  const allowed = role === "SUPER_ADMIN" || role === "ADMIN" || role === "INSTRUCTOR";
  if (checked && !allowed) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <Card>
            <p className="font-display font-semibold text-brand-ink">Game Studio</p>
            <p className="mt-2 text-sm text-gray-600">The Game Studio is for staff who build courses. If you should have it, ask a Super Admin.</p>
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
        <p className="px-3 pb-2 text-xs text-gray-600">
          Want to see how a game feels for trainees? <a className="font-semibold text-brand-teal underline" href="/admin/studio/demo">Play the sample games</a>.
        </p>
        {allowed ? <Studio isSuper={role === "SUPER_ADMIN"} /> : <p className="px-3 py-10 text-sm text-gray-500">Loading…</p>}
      </main>
    </>
  );
}

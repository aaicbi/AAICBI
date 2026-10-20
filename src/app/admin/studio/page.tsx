"use client";
import DesktopRecommended from "@/components/pwa/DesktopRecommended";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import AccessDenied from "@/components/ui/AccessDenied";
import { useMyAccess } from "@/lib/useMyAccess";
import Studio from "@/components/studio/Studio";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/studio: the Game Studio, for the Super Admin and for staff given "Access the Gaming Studio". Each control inside needs its own permission
 * (create, edit, delete, test, publish, assets, engine settings, question bank, Loop). Training organizations never have it. One page where games
 * are created, written with Loop, previewed exactly as trainees will play them, and assigned to modules. See docs/game-studio.md.
 */
export default function StudioPage() {
  const me = useMyAccess();
  const allowed = !!me && me.permissions.has("gaming_studio.access:view");
  if (me && !allowed) {
    return (
      <>
        <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
        <main className="mx-auto max-w-2xl px-6 py-10"><AccessDenied what="the Game Studio" /></main>
      </>
    );
  }

  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-4">
        <DesktopRecommended what="The Game Studio" />
        <h1 className="sr-only">Game Studio</h1>
        {me?.permissions.has("gaming_studio.testing:view") && (
          <p className="px-3 pb-2 text-xs text-gray-600">
            Want to see how a game feels for trainees? <a className="font-semibold text-brand-teal underline" href="/admin/studio/demo">Play the sample games</a>.
          </p>
        )}
        {allowed && me ? <Studio isSuper={me.kind === "super"} can={(k) => me.permissions.has(k)} /> : <p className="px-3 py-10 text-sm text-gray-500">Loading…</p>}
      </main>
    </>
  );
}

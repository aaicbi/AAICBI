"use client";
import { useCallback, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import AccessDenied from "@/components/ui/AccessDenied";
import { useMyAccess } from "@/lib/useMyAccess";
import BackLink from "@/components/ui/BackLink";
import ResultsTable from "@/components/game-results/ResultsTable";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/game-results: how people are doing in the games. Every player (course games, quiz practice and games opened from the feed), with answers,
 * accuracy and latest answers. For the Super Admin and for staff given "Game results: View" (downloading needs "Export" as well). It is separate from
 * the Game Studio: seeing results never opens the Studio. Training organizations see their own trainees' results in their own Games section.
 */
export default function GameResultsPage() {
  const me = useMyAccess();
  const [blocked, setBlocked] = useState<string | null>(null);
  const onForbidden = useCallback((m: string) => setBlocked(m), []);
  const staff = !!me && me.permissions.has("gaming_ops.results:view");
  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <BackLink href="/admin/dashboard">Back to the dashboard</BackLink>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Game results</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-700">Who plays the games and how they do: course games, quiz practice and the games opened on the feed. Open a player to see their latest answers.</p>
        {!me ? (
          <p className="mt-6 text-sm text-gray-500">Loading…</p>
        ) : !staff || blocked ? (
          <div className="mt-6" data-testid="results-blocked">{blocked ? <Card><p className="text-sm text-brand-ink">{blocked}</p></Card> : <AccessDenied what="the game results" />}</div>
        ) : (
          <div className="mt-5 space-y-5">
            <ResultsTable onForbidden={onForbidden} />
          </div>
        )}
      </main>
    </>
  );
}

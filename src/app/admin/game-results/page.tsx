"use client";
import { useCallback, useEffect, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/admin/LogoutButton";
import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import ResultsTable from "@/components/game-results/ResultsTable";
import { ADMIN_NAV_COMMAND } from "@/lib/admin/nav";

/**
 * /admin/game-results — how people are doing in the games. Every player (course games, quiz practice and games opened from the
 * feed), with answers, accuracy and latest answers. A Super Admin also decides here who else may see it: one switch to share it
 * with staff, then a switch per person. See docs/game-studio.md.
 */
export default function GameResultsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRole(typeof d.role === "string" ? d.role : null))
      .catch(() => setRole(null))
      .finally(() => setChecked(true));
  }, []);
  const onForbidden = useCallback((m: string) => setBlocked(m), []);

  const staff = role === "SUPER_ADMIN";
  return (
    <>
      <SiteHeader nav={ADMIN_NAV_COMMAND} right={<LogoutButton />} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <BackLink href="/admin/dashboard">Back to the dashboard</BackLink>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Game results</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-700">Who plays the games and how they do: course games, quiz practice and the games opened on the feed. Open a player to see their latest answers.</p>
        {!checked ? (
          <p className="mt-6 text-sm text-gray-500">Loading…</p>
        ) : !staff || blocked ? (
          <Card className="mt-6" data-testid="results-blocked">
            <p className="font-display font-semibold text-brand-ink">Game results</p>
            <p className="mt-2 text-sm text-gray-600">{blocked ?? "The game results are only for the Super Admin."}</p>
          </Card>
        ) : (
          <div className="mt-5 space-y-5">
            <ResultsTable onForbidden={onForbidden} />
          </div>
        )}
      </main>
    </>
  );
}

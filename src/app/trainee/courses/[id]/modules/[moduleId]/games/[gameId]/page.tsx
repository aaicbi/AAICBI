"use client";
import { useEffect, useMemo, useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import LogoutButton from "@/components/trainee/LogoutButton";
import Card from "@/components/ui/Card";
import BackLink from "@/components/ui/BackLink";
import GameRound from "@/components/games/experience/GameRound";
import { type PlayerApi, type PlayItem, type PlayResult } from "@/components/games/GamePlayer";
import { TRAINEE_NAV } from "@/lib/trainee/nav";

interface LiveGame {
  id: string;
  title: string;
  format: string;
  description: string | null;
  items: number | null;
}

/** Plays one live game of a module: matching cards, put in order, or scenario choices. XP counts as in practice; never toward a certificate. */
export default function GamePage({ params }: { params: { id: string; moduleId: string; gameId: string } }) {
  const [game, setGame] = useState<LiveGame | null | "none">(null);
  const base = `/api/modules/${params.moduleId}/games`;

  useEffect(() => {
    fetch(base)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { games: LiveGame[] }) => {
        const g = d.games.find((x) => x.id === params.gameId);
        if (!g) return setGame("none");
        if (g.format === "QUIZ") {
          window.location.replace(`/trainee/courses/${params.id}/modules/${params.moduleId}/practice`);
          return;
        }
        setGame(g);
      })
      .catch(() => setGame("none"));
  }, [base, params.gameId, params.id, params.moduleId]);

  const api: PlayerApi = useMemo(
    () => ({
      async next() {
        const res = await fetch(`${base}/${params.gameId}/next`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: data.error ?? "Could not load the next item." };
        if (data.done) return { done: true };
        const item: PlayItem = { playId: data.playId, format: data.format, objective: data.objective, served: data.served, minSeconds: data.minSeconds };
        return { item };
      },
      async answer(item, response) {
        const res = await fetch(`${base}/${params.gameId}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playId: item.playId, response }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: data.error ?? "Could not record your answer." };
        return { result: data as PlayResult };
      },
    }),
    [base, params.gameId]
  );

  const back = `/trainee/courses/${params.id}`;

  return (
    <>
      <SiteHeader nav={TRAINEE_NAV} right={<LogoutButton />} />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <BackLink href={back}>Back to the course</BackLink>
        {game === null && <p className="mt-6 text-sm text-gray-500">Loading…</p>}
        {game === "none" && <p className="mt-6 text-sm text-gray-600">This game isn&apos;t available right now.</p>}
        {game && game !== "none" && (
          <>
            <h1 className="mt-2 text-2xl font-bold text-brand-ink">{game.title}</h1>
            {game.description && <p className="mt-1 text-sm text-gray-700">{game.description}</p>}
            <p className="mt-1 text-xs text-gray-600">Playing for practice: the XP you earn here never counts toward your certificate.</p>
            <Card className="mt-5">
              <GameRound title={game.title} api={api} onExit={() => window.location.assign(back)} exitLabel="Back to the course" onEmpty="You've played everything here for now. Come back later." />
            </Card>
          </>
        )}
      </main>
    </>
  );
}

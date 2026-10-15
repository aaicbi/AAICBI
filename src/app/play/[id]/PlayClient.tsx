"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import GameRound from "@/components/games/experience/GameRound";
import CourseNudge from "@/components/games/experience/CourseNudge";
import type { PlayerApi, PlayItem, PlayResult } from "@/components/games/GamePlayer";
import { readSoundPref, writeSoundPref } from "@/lib/games/sound";
import Card from "@/components/ui/Card";
import LoopFace from "@/components/guide/LoopFace";

/** One round of a game opened from the feed, for someone signed in. The browser remembers which items it has seen; the server stores nothing. */
export default function PlayClient({ id, title, courseId, courseTitle, enrolled }: { id: string; title: string; courseId: string; courseTitle: string; enrolled: boolean }) {
  const seen = useRef<string[]>([]);
  // The round opens with a randomly chosen welcome, so it is drawn in the browser only (the server's pick would never match).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const base = `/api/public/play/${id}`;
  const courseHref = enrolled ? `/trainee/courses/${courseId}` : `/courses/${courseId}`;

  // Games are better with their sounds: start with them on unless this device already chose (the speaker button still turns them off).
  useEffect(() => {
    try {
      if (window.localStorage.getItem("aaicbi.game.sound") === null && !readSoundPref(window.localStorage)) writeSoundPref(window.localStorage, true);
    } catch {}
  }, []);

  const api: PlayerApi = useMemo(
    () => ({
      async next() {
        const res = await fetch(`${base}/next`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seen: seen.current }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: res.status === 401 ? "Please sign in again to keep playing." : (data.error ?? "Could not load the next question.") };
        if (data.done) {
          seen.current = [];
          return { done: true };
        }
        seen.current = [...seen.current, data.playId];
        const item: PlayItem = { playId: data.playId, format: data.format, objective: data.objective, served: data.served };
        return { item };
      },
      async answer(item, response) {
        const res = await fetch(`${base}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playId: item.playId, response }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { error: data.error ?? "Could not check your answer." };
        return { result: data as PlayResult };
      },
    }),
    [base]
  );

  const join = (
    <Card className="gx-rise mt-5 bg-card-gradient" data-testid="play-cta">
      <div className="flex items-start gap-3">
        <span className="gx-bounce shrink-0"><LoopFace state="helpful" size={56} /></span>
        <div>
          <h2 className="text-lg font-bold text-brand-ink">{enrolled ? "Keep going in the course" : "Liked that? There is a lot more."}</h2>
          <p className="mt-1 text-sm text-brand-ink">
            {enrolled ? (
              <>Every game, your progress and your certificate are waiting in <strong>{courseTitle}</strong>.</>
            ) : (
              <>This was a taste of <strong>{courseTitle}</strong>. Register to play every game, earn XP, track your progress and work towards a certificate.</>
            )}
          </p>
        </div>
      </div>
      <Link href={courseHref} className="gx-pulse mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover sm:w-auto" data-testid="play-cta-course">
        {enrolled ? "Open the course" : "Register now"}
      </Link>
    </Card>
  );

  if (!mounted) return <p className="text-sm text-gray-500">Loading…</p>;
  return (
    <GameRound
      title={title}
      api={api}
      onExit={() => window.location.assign("/")}
      exitLabel="Back to the feed"
      onEmpty="That's everything here for now."
      after={join}
      // Loop's pop-up is only for people who have not registered for the course, and only after a round they did not pass (under 70%).
      nudge={enrolled ? undefined : { failBelow: 70, render: (close) => <CourseNudge courseTitle={courseTitle} courseHref={courseHref} onClose={close} /> }}
    />
  );
}

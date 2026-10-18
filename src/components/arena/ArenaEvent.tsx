"use client";
import { useState } from "react";
import ArenaFrame from "./ArenaFrame";
import { useArenaLive, channels } from "./useArenaLive";
import type { EventView, EventTieView, EventPlayerView } from "@/lib/arena/event";

const first = (n: string) => n.split(" ")[0];

function Slot({ p, tie, side }: { p: EventPlayerView | null; tie: EventTieView; side: "a" | "b" }) {
  const score = side === "a" ? tie.scoreA : tie.scoreB;
  const won = !!p && tie.winnerId === p.id;
  const lost = !!tie.winnerId && !!p && tie.winnerId !== p.id;
  return (
    <div className={`ar-slot${won ? " ar-w" : ""}${lost ? " ar-l" : ""}`}>
      <span>{p ? `${p.seed ? `${p.seed}. ` : ""}${p.name}` : tie.bye ? "bye" : "to be decided"}</span>
      {tie.playing && score !== null && <b>{score}</b>}
    </div>
  );
}

/**
 * A live event: the knockout bracket, the matches being played, and where you stand. Trainees get a Join button and a Watch link on each live match;
 * the same view with `screen` set is the instructor's big screen (bigger type, no buttons).
 */
export default function ArenaEvent({ url, courseId, screen, backHref, staff }: { url: string; courseId: string; screen?: boolean; backHref: string; staff?: boolean }) {
  const { data: v, error, reload } = useArenaLive<EventView>(url, { listen: staff ? [] : [channels.course(courseId)], pollMs: 2000 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function act(action: "join" | "leave") {
    if (!v || busy) return;
    setBusy(true);
    const res = await fetch(`/api/arena/events/${v.id}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setToast(j.error ?? "That didn't work."); setTimeout(() => setToast(null), 3500); return; }
    void reload();
  }

  if (!v) return <ArenaFrame title="Live event" backHref={backHref}><div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>{error ? error.message : "Opening the event…"}</div></div></ArenaFrame>;
  const playing = v.rounds.flatMap((r) => r.ties).filter((t) => t.playing || (t.status === "READY" && t.a && t.b));
  const m = v.mine;
  return (
    <ArenaFrame title={v.name} backHref={backHref}>
      <div className={`ar-stage${screen ? " ar-bigscreen" : ""}`}>
        <div className="ar-in ar-event">
          <div className="ar-top"><div className="ar-t">{v.status === "SIGNUP" ? "Live event · sign-up" : v.status === "LIVE" ? `Live event · ${v.rounds[Math.max(0, v.round - 1)]?.name ?? ""}` : v.status === "DONE" ? "Live event · finished" : "Live event · cancelled"}</div>{v.status === "LIVE" && <span className="ar-live"><i />Live</span>}<span className="ar-pill ar-gold">{v.players.length} player{v.players.length === 1 ? "" : "s"}</span></div>
          <div className="ar-ebody">
            {!screen && !staff && m && (
              <div className="ar-glass ar-champ" data-testid="event-mine">
                {m.state === "CALLED" && <><div className="ar-crown">Your match · {m.round}</div><p className="ar-name">You play {m.opponent ? first(m.opponent) : "your opponent"}</p>{m.matchId && <a className="ar-btn" href={`/trainee/arena/match/${m.matchId}`} style={{ textDecoration: "none", justifySelf: "start" }}>Go to your match</a>}<p className="ar-muted">Tap Ready within 3 minutes or your opponent goes through.</p></>}
                {m.state === "WAITING" && <p className="ar-name">You're through. Waiting for the other matches in this round.</p>}
                {m.state === "OUT" && <p className="ar-name">You're out, thanks for playing. Keep watching and cheering below.</p>}
                {m.state === "CHAMPION" && <p className="ar-name">👑 You are the champion!</p>}
              </div>
            )}
            {!screen && !staff && v.status === "SIGNUP" && (
              <div className="ar-glass">
                <p className="ar-name">{v.joined ? "You're in. The event starts when your instructor starts it." : "Take a place in the knockout."}</p>
                <button type="button" className={`ar-btn${v.joined ? " ar-ghost" : ""} ar-sm`} style={{ justifySelf: "start" }} disabled={busy} onClick={() => void act(v.joined ? "leave" : "join")}>{v.joined ? "Leave the event" : "Join the event"}</button>
              </div>
            )}
            {v.status === "DONE" && v.champion && <div className="ar-glass ar-champ" data-testid="event-champion"><div className="ar-crown">👑 Champion</div><p className="ar-big">{v.champion.name}</p></div>}
            {v.status === "SIGNUP" ? (
              <div className="ar-glass"><strong>Players so far</strong><div className="ar-chipset">{v.players.length === 0 && <span className="ar-muted">Nobody has joined yet.</span>}{v.players.map((p) => <span key={p.id} className="ar-pill"><span className={`ar-tier ar-t-${p.tierKey.toLowerCase()}`}>{p.tier}</span> {p.name}</span>)}</div></div>
            ) : (
              <>
                <div className="ar-bracket" data-testid="bracket">
                  {v.rounds.map((r) => (
                    <div key={r.round} className="ar-rnd"><h4>{r.name}</h4>
                      {r.ties.map((t) => (
                        <div key={t.id} className={`ar-tie${t.playing ? " ar-now" : ""}`}><Slot p={t.a} tie={t} side="a" /><Slot p={t.b} tie={t} side="b" /></div>
                      ))}
                    </div>
                  ))}
                </div>
                {playing.length > 0 && (
                  <div className="ar-glass" data-testid="event-playing">
                    <div className="ar-row"><strong className="ar-grow">{playing.some((t) => t.playing) ? "Now playing" : "Called to play"}</strong></div>
                    {playing.map((t) => (
                      <div key={t.id} className="ar-row">
                        <div className="ar-grow"><div className="ar-name">{t.a ? first(t.a.name) : "?"} vs {t.b ? first(t.b.name) : "?"}</div><div className="ar-sub">{t.playing ? `question ${t.question} of ${t.questions} · ${t.watching} watching` : `waiting for both to tap Ready${t.readyA || t.readyB ? " (one is ready)" : ""}`}</div></div>
                        {t.playing && <span className="ar-rt">{t.scoreA}–{t.scoreB}</span>}
                        {!screen && !staff && t.playing && t.matchId && m?.matchId !== t.matchId && <a className="ar-btn ar-sm" href={`/trainee/arena/watch/${t.matchId}`} style={{ textDecoration: "none" }}>Watch</a>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}

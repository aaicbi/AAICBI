"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ArenaFrame from "./ArenaFrame";
import ArenaChat from "./ArenaChat";
import PushNudge from "./PushNudge";
import { useArenaLive, channels } from "./useArenaLive";
import type { CourseArenaView } from "@/lib/arena/arenaView";

/** The course arena: who is online, challenges in and out, your current match, and recent results. */
export default function ArenaLobby({ courseId, traineeId }: { courseId: string; traineeId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { data: v, error, setData, reload } = useArenaLive<CourseArenaView>(`/api/arena/courses/${courseId}`, { listen: [channels.course(courseId), channels.user(traineeId)], pollMs: 2000 });

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }, []);

  // Leaving the arena page (closing the tab, going back) takes you off the others' lists straight away.
  // Going to a match is not leaving: you stay in the arena while you play.
  const leaving = useRef(true);
  useEffect(() => {
    const bye = () => { if (leaving.current) navigator.sendBeacon?.(`/api/arena/courses/${courseId}/presence`); };
    window.addEventListener("pagehide", bye);
    return () => { window.removeEventListener("pagehide", bye); };
  }, [courseId]);

  async function challenge(opponentId: string) {
    const res = await fetch(`/api/arena/courses/${courseId}/challenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opponentId, moduleId: topic || null }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That didn't work.");
    if (j.reach && j.reach !== "online") {
      // Not in the arena: stay here and say how it will reach them. The waiting card below opens the match.
      const who = [...v!.online, ...v!.offline].find((p) => p.id === opponentId)?.name.split(" ")[0] ?? "They";
      flash(j.reach === "push" ? `Challenge sent. ${who} gets a notification on their phone.` : `Challenge sent. ${who} hasn't turned on phone alerts, so they'll see it next time they open the app.`);
      void reload();
      return;
    }
    { leaving.current = false; router.push(`/trainee/arena/match/${j.id}`); }
  }
  async function respond(id: string, accept: boolean) {
    const res = await fetch(`/api/arena/matches/${id}/${accept ? "accept" : "decline"}`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That didn't work.");
    if (accept) { leaving.current = false; router.push(`/trainee/arena/match/${id}`); } else { setData((d) => d); void reload(); }
  }

  if (!v) {
    return (
      <ArenaFrame title="Ayakbi Arena" backHref="/trainee/arena">
        <div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>{error ? error.message : "Opening the arena…"}</div></div>
      </ArenaFrame>
    );
  }
  const sus = v.suspension ? `You're suspended from the arena${v.suspension.until ? ` until ${new Date(v.suspension.until).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : ""}${v.suspension.reason ? `: ${v.suspension.reason}` : "."}` : null;
  const busy = !!v.active || !!sus;
  return (
    <ArenaFrame title={`${v.course.title} · Arena`} backHref="/trainee/arena">
      <div className="ar-stage">
        <div className="ar-in">
          <div className="ar-top"><div className="ar-t">Ayakbi Arena</div><span className="ar-row" style={{ gap: ".4em", flex: "none" }}>{v.ladder.enabled && <a href={`/trainee/arena/${courseId}/ladder`} className="ar-pill" data-testid="ladder-link" style={{ textDecoration: "none", color: "inherit" }}>🏆 <span className={`ar-tier ar-t-${v.ladder.tierKey.toLowerCase()}`}>{v.ladder.tier}</span> {v.ladder.rating.toLocaleString()}{v.ladder.rank ? ` · #${v.ladder.rank}` : ""}</a>}<span className="ar-pill ar-gold">{v.rules.questionsPerMatch} questions · {v.rules.questionSeconds}s each</span></span></div>
          <div className={`ar-main ar-two${v.chat.enabled ? " ar-lobby3" : ""}`}>
            <div className="ar-col">
              {sus && !v.chat.enabled && <p className="ar-note ar-miss" role="status">{sus}</p>}
              {v.event && (
                <div className="ar-glass ar-champ" data-testid="event-banner">
                  <div className="ar-crown">⚔️ Live event · {v.event.status === "SIGNUP" ? "sign-up open" : v.event.status === "LIVE" ? "running now" : "finished"}</div>
                  <p className="ar-name">{v.event.name} · {v.event.players} player{v.event.players === 1 ? "" : "s"}</p>
                  <div className="ar-row"><a className="ar-btn ar-sm" href={`/trainee/arena/${courseId}/event/${v.event.id}`} style={{ textDecoration: "none" }}>{v.event.status === "SIGNUP" && !v.event.joined ? "Join the event" : "Open the event"}</a></div>
                </div>
              )}
              {v.live.length > 0 && (
                <div className="ar-glass" data-testid="live-now">
                  <div className="ar-row"><strong className="ar-grow">Live now</strong><span className="ar-live"><i />{v.live.length} match{v.live.length === 1 ? "" : "es"}</span></div>
                  {v.live.map((m) => (
                    <div key={m.id} className="ar-row">
                      <div className="ar-grow"><div className="ar-name">{m.a.split(" ")[0]} vs {m.b.split(" ")[0]}</div><div className="ar-sub">{m.aTier ? `${m.aTier} · ` : ""}question {m.round} of {m.total} · {m.watching} watching{m.event ? " · event" : ""}</div></div>
                      <span className="ar-rt">{m.scoreA}–{m.scoreB}</span>
                      <a className="ar-btn ar-sm" href={`/trainee/arena/watch/${m.id}`} style={{ textDecoration: "none" }}>Watch</a>
                    </div>
                  ))}
                </div>
              )}
              <PushNudge what="challenges" />
              <div className="ar-glass ar-fill ar-lobbylist">
                <div className="ar-row"><strong className="ar-grow">Online now</strong>
                  <select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ maxWidth: "50%" }}>
                    <option value="">Whole course</option>
                    {v.topics.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.count})</option>)}
                  </select>
                </div>
                {v.online.length === 0 && <p className="ar-muted">Nobody else is in the arena right now. You can still challenge a coursemate below, and they'll get a notification on their phone.</p>}
                {v.online.map((p) => (
                  <div key={p.id} className="ar-row">
                    <span className={`ar-dot${p.status === "BUSY" ? " ar-busy" : ""}`} aria-hidden />
                    <div className="ar-av" aria-hidden>{p.initials}</div>
                    <div className="ar-grow"><div className="ar-name">{p.champion ? "👑 " : ""}{p.name}</div><div className="ar-sub">{p.tier && p.tierKey && <><span className={`ar-tier ar-t-${p.tierKey.toLowerCase()}`}>{p.tier}</span> · </>}{p.status === "BUSY" ? "In a match" : "Available"}</div></div>
                    <button type="button" className="ar-btn ar-sm" disabled={busy || p.status === "BUSY"} onClick={() => void challenge(p.id)}>Challenge</button>
                  </div>
                ))}
                {v.offline.length > 0 && (
                  <details className="ar-offline" data-testid="offline-mates">
                    <summary><strong>Not online</strong> · {v.offline.length} coursemate{v.offline.length === 1 ? "" : "s"} you can still challenge</summary>
                    <p className="ar-muted" style={{ margin: ".3em 0" }}>They get a notification on their phone.</p>
                    {v.offline.map((p) => (
                      <div key={p.id} className="ar-row">
                        <span className="ar-dot ar-away" aria-hidden />
                        <div className="ar-av" aria-hidden>{p.initials}</div>
                        <div className="ar-grow"><div className="ar-name">{p.name}</div><div className="ar-sub">{p.tier && p.tierKey && <><span className={`ar-tier ar-t-${p.tierKey.toLowerCase()}`}>{p.tier}</span> · </>}Not online</div></div>
                        <button type="button" className="ar-btn ar-sm" disabled={busy} onClick={() => void challenge(p.id)}>Challenge</button>
                      </div>
                    ))}
                  </details>
                )}
              </div>
            </div>
            <div className="ar-col">
              {v.incoming.map((c) => (
                <div key={c.id} className="ar-glass ar-champ">
                  <div className="ar-crown">Challenge</div>
                  <p className="ar-name">{c.from.name} wants to play{c.topic ? ` · ${c.topic}` : ""}</p>
                  <div className="ar-row"><button type="button" className="ar-btn ar-sm" onClick={() => void respond(c.id, true)}>Accept</button><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => void respond(c.id, false)}>Decline</button></div>
                </div>
              ))}
              {v.outgoing.map((c) => (
                <div key={c.id} className="ar-glass"><p className="ar-name">Waiting for {c.to.name}…</p><button type="button" className="ar-btn ar-ghost ar-sm" onClick={() => router.push(`/trainee/arena/match/${c.id}`)}>Open</button></div>
              ))}
              {v.active && v.active.status !== "PENDING" && (
                <div className="ar-glass ar-champ"><div className="ar-crown">Game on</div><p className="ar-name">Your match with {v.active.opponentName} is waiting</p><button type="button" className="ar-btn ar-sm" onClick={() => router.push(`/trainee/arena/match/${v.active!.id}`)}>Go to match</button></div>
              )}
              <div className="ar-glass ar-fill ar-lobbylist">
                <strong>Recent matches</strong>
                {v.recent.length === 0 && <p className="ar-muted">No matches yet. Challenge someone!</p>}
                {v.recent.map((r) => (
                  <div key={r.id} className="ar-row"><span className="ar-grow">vs {r.opponentName}</span><span className="ar-pill">{r.result === "won" ? "Won" : r.result === "lost" ? "Lost" : r.result === "draw" ? "Draw" : "Ended"} {r.myScore}–{r.opponentScore}</span></div>
                ))}
              </div>
            </div>
            {v.chat.enabled && <div className="ar-col ar-chatcol"><ArenaChat courseId={courseId} chat={v.chat} suspended={sus} online={v.online} offline={v.offline} busy={busy} onChanged={() => void reload()} flash={flash} /></div>}
          </div>
        </div>
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}

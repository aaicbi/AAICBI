"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ArenaFrame from "./ArenaFrame";
import { useArenaLive, channels } from "./useArenaLive";
import type { CourseArenaView } from "@/lib/arena/arenaView";

/** The course arena: who is online, challenges in and out, your current match, and recent results. */
export default function ArenaLobby({ courseId, traineeId }: { courseId: string; traineeId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { data: v, error, setData, reload } = useArenaLive<CourseArenaView>(`/api/arena/courses/${courseId}`, { listen: [channels.course(courseId), channels.user(traineeId)], pollMs: 2500 });

  const flash = useCallback((m: string) => { setToast(m); setTimeout(() => setToast((t) => (t === m ? null : t)), 3500); }, []);
  useEffect(() => { if (v?.active && v.active.status === "ACTIVE") router.push(`/trainee/arena/match/${v.active.id}`); }, [v?.active, router]);

  async function challenge(opponentId: string) {
    const res = await fetch(`/api/arena/courses/${courseId}/challenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opponentId, moduleId: topic || null }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That didn't work.");
    router.push(`/trainee/arena/match/${j.id}`);
  }
  async function respond(id: string, accept: boolean) {
    const res = await fetch(`/api/arena/matches/${id}/${accept ? "accept" : "decline"}`, { method: "POST" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return flash(j.error ?? "That didn't work.");
    if (accept) router.push(`/trainee/arena/match/${id}`); else { setData((d) => d); void reload(); }
  }

  if (!v) {
    return (
      <ArenaFrame title="Gaming Arena" backHref="/trainee/arena">
        <div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>{error ? error.message : "Opening the arena…"}</div></div>
      </ArenaFrame>
    );
  }
  const busy = !!v.active;
  return (
    <ArenaFrame title={`${v.course.title} · Arena`} backHref="/trainee/arena">
      <div className="ar-stage">
        <div className="ar-in">
          <div className="ar-top"><div className="ar-t">The Interview</div><span className="ar-pill ar-gold">{v.rules.questionsPerMatch} questions · {v.rules.questionSeconds}s each</span></div>
          <div className="ar-main ar-two">
            <div className="ar-col">
              <div className="ar-glass ar-fill ar-lobbylist">
                <div className="ar-row"><strong className="ar-grow">Online now</strong>
                  <select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ maxWidth: "50%" }}>
                    <option value="">Whole course</option>
                    {v.topics.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.count})</option>)}
                  </select>
                </div>
                {v.online.length === 0 && <p className="ar-muted">Nobody else is in the arena yet. Ask a coursemate to open it.</p>}
                {v.online.map((p) => (
                  <div key={p.id} className="ar-row">
                    <span className={`ar-dot${p.status === "BUSY" ? " ar-busy" : ""}`} aria-hidden />
                    <div className="ar-av" aria-hidden>{p.initials}</div>
                    <div className="ar-grow"><div className="ar-name">{p.name}</div><div className="ar-sub">{p.status === "BUSY" ? "In a match" : "Available"}</div></div>
                    <button type="button" className="ar-btn ar-sm" disabled={busy || p.status === "BUSY"} onClick={() => void challenge(p.id)}>Challenge</button>
                  </div>
                ))}
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
                <div className="ar-glass"><p className="ar-name">Your match with {v.active.opponentName}</p><button type="button" className="ar-btn ar-sm" onClick={() => router.push(`/trainee/arena/match/${v.active!.id}`)}>Go to match</button></div>
              )}
              <div className="ar-glass ar-fill ar-lobbylist">
                <strong>Recent matches</strong>
                {v.recent.length === 0 && <p className="ar-muted">No matches yet. Challenge someone!</p>}
                {v.recent.map((r) => (
                  <div key={r.id} className="ar-row"><span className="ar-grow">vs {r.opponentName}</span><span className="ar-pill">{r.result === "won" ? "Won" : r.result === "lost" ? "Lost" : r.result === "draw" ? "Draw" : "Ended"} {r.myScore}–{r.opponentScore}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}

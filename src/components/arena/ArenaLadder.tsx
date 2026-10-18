"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ArenaFrame from "./ArenaFrame";
import type { LadderView, LadderEntry } from "@/lib/arena/ladder";

type Period = "week" | "month" | "all";
const PERIODS: { k: Period; label: string }[] = [{ k: "week", label: "This week" }, { k: "month", label: "This month" }, { k: "all", label: "All time" }];

const Delta = ({ n }: { n: number }) => (n === 0 ? <span className="ar-delta ar-muted">—</span> : <span className={`ar-delta ${n > 0 ? "ar-up" : "ar-down"}`}>{n > 0 ? "▲" : "▼"} {Math.abs(n)}</span>);
const Tier = ({ e }: { e: { tier: string; tierKey: string } }) => <span className={`ar-tier ar-t-${e.tierKey.toLowerCase()}`}>{e.tier}</span>;

/** The course's champion ladder: a podium for the top three, everyone below, and your own place pinned at the bottom. */
export default function ArenaLadder({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("week");
  const [v, setV] = useState<LadderView | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/arena/courses/${courseId}/ladder?period=${period}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(j.error ?? "The ladder couldn't load.");
    setErr(null); setV(j);
  }, [courseId, period]);
  useEffect(() => { void load(); const id = setInterval(() => { if (!document.hidden) void load(); }, 10_000); return () => clearInterval(id); }, [load]);

  async function challenge(e: LadderEntry) {
    const res = await fetch(`/api/arena/courses/${courseId}/challenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ opponentId: e.id, moduleId: null }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { setToast(j.error ?? "That didn't work."); setTimeout(() => setToast(null), 3500); return; }
    if (j.reach && j.reach !== "online") {
      const who = e.name.split(" ")[0];
      setToast(j.reach === "push" ? `Challenge sent. ${who} gets a notification on their phone.` : `Challenge sent. ${who} won't get a phone alert, so they'll see it next time they open the app.`);
      setTimeout(() => setToast(null), 5000);
      return;
    }
    router.push(`/trainee/arena/match/${j.id}`);
  }

  const back = `/trainee/arena/${courseId}`;
  if (!v) return <ArenaFrame title="Champion ladder" backHref={back}><div className="ar-stage"><div className="ar-in" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>{err ?? "Opening the ladder…"}</div></div></ArenaFrame>;
  const [first, second, third] = v.entries;
  const pod = (e: LadderEntry | undefined, cls: string) => e ? (
    <div className={`ar-pod ${cls}`}>
      {e.champion && <span className="ar-crownem" role="img" aria-label="Last week's champion">👑</span>}
      <span className="ar-av">{e.initials}</span><b>{e.name.split(" ")[0]}</b><Tier e={e} /><span className="ar-prate">{period === "all" ? e.rating.toLocaleString() : `${e.change > 0 ? "+" : e.change < 0 ? "−" : ""}${Math.abs(e.change)}`}</span>
    </div>
  ) : <div className={`ar-pod ar-empty ${cls}`} />;
  const rest = v.entries.slice(3);
  return (
    <ArenaFrame title="Champion ladder" backHref={back}>
      <div className="ar-stage">
        <div className="ar-in ar-ladder">
          <div className="ar-top"><div className="ar-t">Champion ladder</div><span className="ar-pill ar-gold">{v.weekLabel}</span></div>
          {!v.enabled ? <div className="ar-glass"><p className="ar-muted">The champion ladder isn't open for this course yet.</p></div> : (
            <div className="ar-board">
              <div className="ar-seg" role="group" aria-label="Period">{PERIODS.map((p) => <button key={p.k} type="button" className={period === p.k ? "ar-on" : ""} aria-pressed={period === p.k} onClick={() => setPeriod(p.k)}>{p.label}</button>)}</div>
              {v.entries.length === 0 ? (
                <div className="ar-glass"><p className="ar-muted">{period === "week" ? "Nobody has finished matches this week yet." : "Nobody is on the ladder yet."} Play {v.me.needMore > 0 ? `${v.me.needMore} more match${v.me.needMore === 1 ? "" : "es"}` : "a match"} to get on it.</p></div>
              ) : (
                <>
                  <div className="ar-podium">{pod(second, "ar-p2")}{pod(first, "ar-p1")}{pod(third, "ar-p3")}</div>
                  <div className="ar-lrows">
                    {rest.map((e) => (
                      <div key={e.id} className={`ar-lrow${e.mine ? " ar-me" : ""}`}>
                        <span className="ar-rk">{e.rank}</span><span className="ar-av">{e.initials}</span>
                        <div className="ar-nm"><b>{e.name}{e.champion ? " 👑" : ""}</b><small><Tier e={e} /> {e.online ? "· online" : ""}</small></div>
                        <Delta n={e.change} /><span className="ar-rt">{e.rating.toLocaleString()}</span>
                        {!e.mine && <button type="button" className="ar-btn ar-sm" onClick={() => void challenge(e)}>Challenge</button>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="ar-you" data-testid="ladder-me">
                <span className="ar-av">YOU</span>
                <div className="ar-grow">
                  <b>{v.me.rank ? `You · #${v.me.rank}` : "You"} · <Tier e={v.me} /> · {v.me.rating.toLocaleString()}</b>
                  {v.me.needMore > 0 ? <small className="ar-muted"> Play {v.me.needMore} more match{v.me.needMore === 1 ? "" : "es"} to join the ladder.</small> : v.me.toNext && <><div className="ar-meter"><i style={{ width: `${Math.round(v.me.toNext.fraction * 100)}%` }} /></div><small className="ar-muted">{v.me.toNext.toNext} points to {v.me.toNext.next}</small></>}
                </div>
              </div>
            </div>
          )}
        </div>
        {toast && <div className="ar-toast" role="alert">{toast}</div>}
      </div>
    </ArenaFrame>
  );
}

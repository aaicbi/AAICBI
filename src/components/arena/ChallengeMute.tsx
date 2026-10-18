"use client";
import { useCallback, useEffect, useState } from "react";

interface Prefs { challengeMuted: boolean; until: number | null; forever: boolean }
type Choice = "off" | "1h" | "8h" | "forever";

const OPTIONS: { k: Choice; label: string }[] = [
  { k: "1h", label: "Mute for 1 hour" },
  { k: "8h", label: "Mute for 8 hours" },
  { k: "forever", label: "Mute until I turn it back on" },
];

/**
 * Challenge alerts on your phone: on, or muted for a while. Muting only holds back the phone notification and the on-screen bar;
 * challenges still wait for you in the arena, and the person who sent one is told you won't get a phone alert.
 */
export default function ChallengeMute() {
  const [p, setP] = useState<Prefs | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { const r = await fetch("/api/arena/prefs", { cache: "no-store" }); if (r.ok) setP(await r.json()); }, []);
  useEffect(() => { void load(); }, [load]);
  async function choose(mute: Choice) {
    const r = await fetch("/api/arena/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mute }) });
    if (r.ok) setP(await r.json());
    setOpen(false);
  }
  if (!p) return null;
  const until = p.until ? new Date(p.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  return (
    <div className="ar-mute" data-testid="challenge-mute">
      <button type="button" className="ar-pill" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", color: "inherit" }}>
        {p.challengeMuted ? "🔕" : "🔔"} Challenge alerts: {p.challengeMuted ? (p.forever ? "muted" : `muted until ${until}`) : "on"}
      </button>
      {open && (
        <div className="ar-glass ar-mutemenu" role="menu">
          {p.challengeMuted && <button type="button" role="menuitem" className="ar-btn ar-sm" onClick={() => void choose("off")}>Turn alerts back on</button>}
          {OPTIONS.map((o) => <button key={o.k} type="button" role="menuitem" className="ar-btn ar-ghost ar-sm" onClick={() => void choose(o.k)}>{o.label}</button>)}
          <p className="ar-muted" style={{ margin: 0, fontSize: ".8em" }}>Muting holds back the phone notification. Challenges still wait for you here in the arena.</p>
        </div>
      )}
    </div>
  );
}

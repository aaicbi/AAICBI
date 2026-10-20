"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import { Checkbox, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

interface Policy { resultsView: boolean; resultsExport: boolean; liveMonitor: boolean; endSessions: boolean; restrictTrainees: boolean; removeParticipants: boolean; chatGameModeration: boolean; toggleGames: boolean; courseRules: boolean }
const ROWS: Array<[keyof Policy, string, string]> = [
  ["resultsView", "See game results", "Scores, attempts and progress of its own trainees."],
  ["resultsExport", "Download results", "Export the results table as a spreadsheet (owners and managers). Off by default."],
  ["liveMonitor", "Watch live games", "See games its trainees are playing now."],
  ["endSessions", "End a game session", "Stop a live game (owners and managers)."],
  ["restrictTrainees", "Restrict a trainee's participation", "Pause a trainee from the course's games and game chat."],
  ["removeParticipants", "Remove a participant from a game", "End a game and remove one of its players."],
  ["chatGameModeration", "Moderate course group chat games", "Remove game messages and stop chat games."],
  ["toggleGames", "Switch games on or off for its courses", "Only where the platform already allows them. Off by default."],
  ["courseRules", "Set participation rules for its courses", "Seconds per question, bonus, pauses and the like."],
];

/** Super Admin: what each training organization may do with its own trainees' games. Training organizations never get the Gaming Studio, whatever is chosen here. */
export default function OrgGamingPolicyPanel() {
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [id, setId] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { fetch("/api/admin/arena?scopeType=ORGANIZATION").then((r) => (r.ok ? r.json() : null)).then((j) => j && setOrgs(j.organizations ?? [])).catch(() => undefined); }, []);
  useEffect(() => {
    if (!id) { setPolicy(null); return; }
    fetch(`/api/admin/orgs/${id}/gaming-policy`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => setPolicy(j?.policy ?? null)).catch(() => setPolicy(null));
  }, [id]);

  async function set(k: keyof Policy, v: boolean) {
    setBusy(true);
    const res = await fetch(`/api/admin/orgs/${id}/gaming-policy`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [k]: v }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { showToast(typeof j.error === "string" ? j.error : "That did not save.", "error"); return; }
    setPolicy(j.policy); showToast("Saved. It applies on the organization's next request.");
  }

  return (
    <section aria-labelledby="orgpol-h" data-testid="org-policy">
      <h2 id="orgpol-h" className="font-display text-lg font-semibold text-brand-ink">What an organization may do with its trainees&apos; games</h2>
      <p className="mt-1 max-w-2xl text-sm text-gray-600">Training organizations never have the Game Studio. This decides how much they can supervise: results, live games, moderation and settings for their own trainees and courses only.</p>
      <Card className="mt-3">
        <Select label="Organization" value={id} onChange={(e) => setId(e.target.value)} data-testid="org-policy-select">
          <option value="">Choose an organization</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </Select>
        {policy && (
          <div className="mt-3 space-y-1">
            {ROWS.map(([k, label, hint]) => <Checkbox key={k} label={label} hint={hint} checked={policy[k]} disabled={busy} onChange={(e) => void set(k, e.target.checked)} data-testid={`policy-${k}`} />)}
          </div>
        )}
      </Card>
    </section>
  );
}

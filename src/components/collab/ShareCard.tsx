"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type Kind = "COURSE" | "EXAM" | "ASSIGNMENT";
const WORD: Record<Kind, string> = { COURSE: "course", EXAM: "examination", ASSIGNMENT: "assignment" };

interface Sharing {
  title: string;
  youAre: "owner" | "editor";
  owner: string;
  links: Array<{ id: string; role: "EDITOR" | "COPY"; createdByName: string; expiresAt: string; uses: number; maxUses: number; mine: boolean }>;
  collaborators: Array<{ id: string; name: string; role: string; since: string; you: boolean }>;
}

/**
 * "Work on this together": make a link, send it to a colleague (or another organization), and they join as an editor after
 * signing in. Editors change the content; publishing, pricing, deleting and sharing control stay with the owner. A course's
 * owner can also make a "copy" link, which gives another organization its own independent copy to run.
 */
export default function ShareCard({ type, id }: { type: Kind; id: string }) {
  const { showToast } = useToast();
  const [data, setData] = useState<Sharing | null>(null);
  const [fresh, setFresh] = useState<{ url: string; role: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/collab/links?type=${type}&id=${id}`);
    if (!r.ok) return setFailed(true);
    setData(await r.json());
  }, [type, id]);
  useEffect(() => { load(); }, [load]);

  async function make(role: "EDITOR" | "COPY") {
    setBusy(true);
    const r = await fetch("/api/collab/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, role }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return showToast(d.error ?? "Could not make a link.", "error");
    setFresh({ url: d.url, role });
    load();
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); showToast("Link copied.", "success"); } catch { showToast("Select the link and copy it.", "error"); }
  }
  async function del(path: string, ok: string) {
    const r = await fetch(path, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return showToast(d.error ?? "That did not work.", "error");
    showToast(ok, "success");
    load();
  }

  if (failed || !data) return null;
  const owner = data.youAre === "owner";
  return (
    <Card className="mt-6">
      <h2 className="font-display text-lg font-semibold text-brand-ink">Work on this together</h2>
      <p className="mt-1 text-sm text-gray-700">
        {owner ? `Send a link and a colleague, instructor or another organization can help build this ${WORD[type]}. They sign in, open the link and join as an editor. Editors change the content; you keep publishing, pricing, deleting and sharing.` : `You are an editor of this ${WORD[type]}, owned by ${data.owner}. You can edit it and invite other editors. Publishing and deleting stay with the owner.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" loading={busy} onClick={() => make("EDITOR")}>Make an invite link</Button>
        {owner && type === "COURSE" && <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => make("COPY")}>Make a copy link for another organization</Button>}
      </div>
      {fresh && (
        <div className="mt-3 rounded-xl border border-brand-teal bg-brand-mint/40 p-3">
          <p className="text-sm font-semibold text-brand-ink">{fresh.role === "COPY" ? "Copy link (gives them their own copy)" : "Invite link"}. It is shown only now; it works for 7 days and up to 10 people.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input readOnly value={fresh.url} onFocus={(e) => e.currentTarget.select()} aria-label="Share link" className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink" />
            <Button type="button" size="sm" onClick={() => copy(fresh.url)}>Copy</Button>
          </div>
        </div>
      )}
      {data.links.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Links that still work</h3>
          <ul className="mt-2 space-y-2">
            {data.links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="min-w-0 text-gray-700">{l.role === "COPY" ? "Copy link" : "Invite link"} by {l.createdByName} · {l.uses}/{l.maxUses} used · until {new Date(l.expiresAt).toLocaleDateString()}</span>
                {(owner || l.mine) && <button type="button" onClick={() => del(`/api/collab/links/${l.id}`, "Link cancelled.")} className="min-h-[36px] text-sm font-semibold text-brand-rose hover:underline">Cancel</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">Who can edit</h3>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="text-gray-800"><strong>{data.owner}</strong> <span className="text-gray-600">· owner</span></li>
          {data.collaborators.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-gray-800"><strong>{c.name}</strong>{c.you ? " (you)" : ""} <span className="text-gray-600">· editor since {new Date(c.since).toLocaleDateString()}</span></span>
              {(owner || c.you) && <button type="button" onClick={() => del(`/api/collab/collaborators/${c.id}`, c.you ? "You left." : "Removed.")} className="min-h-[36px] text-sm font-semibold text-brand-rose hover:underline">{c.you ? "Leave" : "Remove"}</button>}
            </li>
          ))}
          {data.collaborators.length === 0 && <li className="text-gray-600">Nobody else yet.</li>}
        </ul>
      </div>
    </Card>
  );
}

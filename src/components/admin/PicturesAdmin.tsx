"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { KIND_LABEL, prettyBytes, type PictureKind } from "@/lib/pictures/core";

interface Scan { total: number; large: number; largeBytes: number; byKind: Array<{ kind: PictureKind; total: number; large: number; bytes: number }> }
interface Report { tried: number; shrunk: number; unchanged: number; failed: number; savedBytes: number }

const primary = "min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60";

/** Super Admin: shrink the pictures people uploaded before the editor started saving them small. */
export default function PicturesAdmin() {
  const { showToast } = useToast();
  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [last, setLast] = useState<Report | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/pictures", { cache: "no-store" });
    if (!res.ok) { setError("The pictures could not be checked."); return; }
    setScan(await res.json()); setError(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function shrink() {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/admin/pictures", { method: "POST" });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(j.error ?? "That did not work. Try again."); return; }
    const { report, ...next } = j as { report: Report } & Scan;
    setScan(next); setLast(report); setSaved((s) => s + report.savedBytes);
    showToast(report.shrunk > 0 ? `${report.shrunk} picture${report.shrunk === 1 ? "" : "s"} shrunk.` : "Nothing more to shrink.");
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!scan) return <SkeletonList rows={3} />;
  return (
    <div data-testid="pictures-admin">
      <Card>
        <p className="text-sm text-brand-ink" data-testid="pictures-summary">
          {scan.total === 0 ? "No pictures are stored yet." : scan.large === 0 ? `All ${scan.total} stored pictures are already small.` : `${scan.large} of ${scan.total} stored pictures are large (${prettyBytes(scan.largeBytes)} together).`}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-700">
          {scan.byKind.filter((k) => k.total > 0).map((k) => <li key={k.kind}>{KIND_LABEL[k.kind]}: {k.total} stored, {k.large} large{k.large > 0 ? ` (${prettyBytes(k.bytes)})` : ""}</li>)}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={primary} disabled={busy || scan.large === 0} onClick={() => void shrink()} data-testid="pictures-shrink">{busy ? "Shrinking…" : scan.large === 0 ? "Nothing to shrink" : "Shrink the next batch"}</button>
          {scan.large > 0 && <span className="text-xs text-gray-600">A batch takes up to a minute. Press it again until none are left.</span>}
        </div>
        {problem && <p role="alert" className="mt-3 text-sm text-brand-rose">{problem}</p>}
        {last && <p className="mt-3 text-sm text-brand-ink" data-testid="pictures-report">Last batch: {last.shrunk} shrunk, {last.unchanged} already as small as they can be, {last.failed} could not be read. Space saved so far: {prettyBytes(saved)}.</p>}
      </Card>
      <p className="mt-3 max-w-2xl text-xs text-gray-600">Each picture is resized to the most it is ever shown at (480 px for profile photos and logos, 1280 px for flyers, 1600 px for covers) and saved as WebP. The record is pointed at the new file before the old one is removed, and certificate templates are never touched.</p>
    </div>
  );
}

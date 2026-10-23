"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Toggle from "@/components/ui/Toggle";

interface View { enabled: boolean; open: boolean; reason: string | null; registered: number; link: string; qrHint: string }
const WHY: Record<string, string> = { NOT_AVAILABLE: "Not open yet. Switch it on, or set a start date to make this a coming-soon course.", CLOSED: "Closed (past the deadline or the course has ended).", FULL: "Full." };

/** The course's public registration page: switch it on, copy the link, see how many registered. Coming-soon courses are open without the switch. */
export default function CourseRegistrationCard({ courseId, showToast }: { courseId: string; showToast: (m: string) => void }) {
  const [v, setV] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await fetch(`/api/admin/courses/${courseId}/registration`); if (r.ok) setV(await r.json()); }, [courseId]);
  useEffect(() => { void load(); }, [load]);
  async function set(enabled: boolean) {
    setBusy(true);
    const r = await fetch(`/api/admin/courses/${courseId}/registration`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
    setBusy(false);
    if (r.ok) { setV(await r.json()); showToast(enabled ? "Registration page is on." : "Registration page is off."); } else showToast("That didn't work.");
  }
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); showToast(`${what} copied.`); } catch { showToast("Copy it by hand from the box."); }
  }
  if (!v) return null;
  return (
    <Card className="mt-6" data-testid="course-registration">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-brand-ink">Registration page</h2>
        <Badge variant={v.open ? "success" : "neutral"}>{v.open ? "Open" : "Closed"}</Badge>
      </div>
      <p className="mt-1 text-sm text-gray-600">A public page where people read about this course, sign the agreement and register. They join your CRM automatically. Coming-soon courses are open without the switch.</p>
      <div className="mt-3"><Toggle label="Registration page is on" checked={v.enabled} disabled={busy} onChange={set} /></div>
      {!v.open && v.reason && <p className="mt-2 text-sm text-brand-ink">{WHY[v.reason] ?? "Closed."}</p>}
      <p className="mt-3 text-sm text-brand-ink"><strong>{v.registered}</strong> registered so far.</p>
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2"><input readOnly aria-label="Registration link" value={v.link} className="min-w-0 flex-1 rounded-lg border border-brand-gray bg-brand-surface px-3 py-2 text-sm text-brand-ink" /><button type="button" className="min-h-[44px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint" onClick={() => copy(v.link, "Link")}>Copy link</button></div>
        <p className="text-xs text-gray-600">Add <code>?src=name</code> to any link, like a WhatsApp group name, to see where registrations come from. Use <code>?src=qr</code> for a QR code.</p>
      </div>
    </Card>
  );
}

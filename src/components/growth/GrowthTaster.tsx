"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface TQ { questionId: string; position: number; status: string; stillUsable: boolean; text: string; objective: string | null; options: { key: string; text: string; isCorrect: boolean }[] }
interface View {
  taster: { moduleTitle: string | null; available: number; slug: string | null; enabled: boolean; approvedAt: string | null; questions: TQ[] };
  live: boolean; issues: string[]; link: string | null;
}

/** The instructor approves the five questions newcomers play for free. Nothing goes live until all five are approved and a Super Admin switches the course on. */
export default function GrowthTaster({ courseId, showToast }: { courseId: string; showToast: (m: string) => void }) {
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/courses/${courseId}/growth`);
    if (res.ok) setView(await res.json());
  }, [courseId]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, string>, done?: string) {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/courses/${courseId}/growth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(json.error ?? "That didn't work."); return; }
    setView(json);
    if (done) showToast(done);
  }

  if (!view) return null;
  const t = view.taster;
  const approved = t.questions.filter((q) => q.status === "APPROVED").length;
  return (
    <Card className="mt-6" data-testid="growth-taster">
      <h2 className="font-display text-lg font-semibold text-brand-ink">Free taster game</h2>
      <p className="mt-1 text-sm text-gray-600">
        Newcomers can play 5 questions from {t.moduleTitle ? <strong>{t.moduleTitle}</strong> : "module 1"} with no account, then start module 1 free. You approve the five questions. Nothing goes live until all five are approved and the AAICBI team switches the course on.
      </p>
      {t.questions.length === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-brand-ink">{t.available >= 5 ? `${t.available} approved practice questions are ready to draw from.` : `Module 1 has ${t.available} approved practice questions. It needs at least 5.`}</p>
          <button type="button" disabled={busy || t.available < 5} onClick={() => act({ action: "propose" }, "Five questions picked. Review them below.")} className="mt-2 min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60">Pick 5 questions</button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm font-semibold text-brand-ink" aria-live="polite">{approved} of {t.questions.length} approved {t.approvedAt ? <Badge variant="success">Approved</Badge> : null} {view.live ? <Badge variant="success">Live</Badge> : null}</p>
          <ol className="mt-2 space-y-3">
            {t.questions.map((q, i) => (
              <li key={q.questionId} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3">
                <p className="text-sm font-semibold text-brand-ink">{i + 1}. {q.text}</p>
                {q.objective && <p className="mt-0.5 text-xs text-gray-600">Learning objective: {q.objective}</p>}
                <ul className="mt-2 space-y-1 text-sm">
                  {q.options.map((o) => <li key={o.key} className={o.isCorrect ? "font-semibold text-brand-tealDeep" : "text-brand-ink"}>{o.isCorrect ? "✓ " : "· "}{o.text}</li>)}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {q.status === "APPROVED" && q.stillUsable ? <Badge variant="success">Approved</Badge> : (
                    <button type="button" disabled={busy || !q.stillUsable} onClick={() => act({ action: "approve", questionId: q.questionId })} className="min-h-[40px] rounded-full bg-brand-action px-4 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60">Approve</button>
                  )}
                  <button type="button" disabled={busy} onClick={() => act({ action: "swap", questionId: q.questionId }, "Swapped for another question.")} className="min-h-[40px] rounded-full border border-brand-gray px-4 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60">Swap this question</button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" disabled={busy} onClick={() => act({ action: "propose" }, "A new set of five was picked.")} className="mt-3 text-sm font-semibold text-brand-teal underline">Start over with a new set of five</button>
        </>
      )}
      {err && <p className="mt-2 text-sm text-brand-rose" role="alert">{err}</p>}
      {view.link && <p className="mt-3 break-all text-sm text-gray-600">Public link: {view.link}{view.live ? "" : " (not live yet)"}</p>}
    </Card>
  );
}

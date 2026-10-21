"use client";
import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ErrorState from "@/components/ui/ErrorState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { LEDGER_LABEL, NOTE_MAX, PERIODS, PERIOD_LABEL, naira, type FunnelCounts, type FunnelStep, type LedgerStatus, type Period } from "@/lib/growth/reportCore";
import ExpandSelect from "@/components/ui/ExpandSelect";

interface LedgerRow { id: string; paidAt: string; trainee: string; course: string; organization: string | null; source: string; amountKobo: number; rateBps: number; commissionKobo: number; status: LedgerStatus; note: string | null; settledAt: string | null; reference: string | null }
interface Summary { payments: number; amountKobo: number; owedKobo: number; settledKobo: number; reversedKobo: number; owedCount: number; settledCount: number; reversedCount: number; earnedKobo: number }
interface Report {
  period: Period;
  scope: { kind: string; organization: string | null };
  organizations: { id: string; name: string }[];
  campaigns: number;
  funnel: FunnelStep[];
  extras: { scholarships: number; squads: number; challenges: number; optedOut: number; messagesSent: number; messagesDelivered: number; messagesFailed: number };
  sources: { label: string; funnel: FunnelCounts }[];
  courses: { courseId: string; title: string; organization: string | null; funnel: FunnelCounts; earnedKobo: number }[];
  commission: { summary: Summary; unrated: { count: number; amountKobo: number }; rates: { organizationId: string; name: string; percent: number | null }[]; ledgerShown: number; ledgerTotal: number; ledger: LedgerRow[] };
  canSettle: boolean;
}

const STATUS_VARIANT: Record<LedgerStatus, "warning" | "success" | "danger"> = { OWED: "warning", SETTLED: "success", REVERSED: "danger" };

/** The campaign report and commission ledger. */
export default function GrowthReport({ isSuper }: { isSuper: boolean }) {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<Period>("30d");
  const [org, setOrg] = useState("all");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/growth/report?period=${period}&org=${encodeURIComponent(org)}`);
    if (!res.ok) { setError("The report could not be loaded."); return; }
    setData(await res.json());
    setError(null);
    setPicked(new Set());
  }, [period, org]);
  useEffect(() => { void load(); }, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true); setProblem(null);
    const res = await fetch("/api/admin/growth/commissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setProblem(json.error ?? "That didn't work."); return; }
    showToast(json.settled ? `${json.settled} marked settled.` : done);
    setReversing(null); setReason(""); setNote("");
    await load();
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <SkeletonList rows={4} />;
  const c = data.commission;
  const started = data.funnel[0]?.count ?? 0;
  const owedRows = c.ledger.filter((r) => r.status === "OWED");
  const csvHref = `/api/admin/growth/report?period=${period}&org=${encodeURIComponent(org)}&format=csv`;

  return (
    <div className="space-y-6" data-testid="growth-report">
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Period" className="flex flex-wrap gap-1">
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p} data-testid={`period-${p}`}
              className={`min-h-[40px] rounded-full border px-4 text-sm font-semibold ${period === p ? "border-brand-action bg-brand-mint text-brand-tealDeep" : "border-brand-gray bg-brand-surface text-brand-ink hover:border-brand-teal"}`}>{PERIOD_LABEL[p]}</button>
          ))}
        </div>
        {isSuper && (
          <label className="block text-sm"><span className="font-semibold text-brand-ink">Show</span>
            <ExpandSelect compact value={org} onChange={(e) => setOrg(e.target.value)} className="mt-1 block min-h-[40px] rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="org-select">
              <option value="all">Everything</option><option value="aaicbi">AAICBI&apos;s own courses</option>
              {data.organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </ExpandSelect></label>
        )}
        <a href={csvHref} className="ml-auto inline-flex min-h-[40px] items-center rounded-full border border-brand-action px-4 text-sm font-semibold text-brand-action hover:bg-brand-mint" data-testid="download-csv">Download the ledger (CSV)</a>
      </div>

      {data.campaigns === 0 ? (
        <Card><p className="text-sm text-brand-ink">No campaign has been set up for {isSuper ? "this choice" : "your courses"} yet. Once a course&apos;s taster link is switched on and people play it, the numbers appear here.</p></Card>
      ) : (
        <>
          <section aria-labelledby="funnel-h">
            <h2 id="funnel-h" className="font-display text-lg font-semibold text-brand-ink">From the taster to a payment</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">People who started the taster in this period, and how far they got. &quot;Started&quot; counts people who pressed Start, not everyone who opened the link. Saving a score is optional, so a later step can be bigger than an earlier one.</p>
            <ol className="mt-3 space-y-2" data-testid="funnel">
              {data.funnel.map((s) => (
                <li key={s.key} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3" data-testid={`funnel-${s.key}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold text-brand-ink">{s.label}</span><span className="font-display text-xl font-bold text-brand-ink">{s.count}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-gray/40" aria-hidden="true"><div className="h-full bg-brand-action" style={{ width: `${started > 0 ? Math.min(100, Math.round((s.count / started) * 100)) : 0}%` }} /></div>
                  {s.ofStarted !== null && <p className="mt-1 text-xs text-gray-600">{s.ofStarted}% of those who started{s.ofPrevious !== null && s.ofPrevious <= 100 ? ` · ${s.ofPrevious}% of the step before` : ""}</p>}
                </li>
              ))}
            </ol>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="extras">
              {[["Scholarship seats given", data.extras.scholarships], ["Friend challenges played", data.extras.challenges], ["Squads started", data.extras.squads], ["Follow-up messages sent", data.extras.messagesSent], ["Opted out of messages", data.extras.optedOut]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-brand-surface p-3"><dt className="text-xs text-gray-600">{k}</dt><dd className="font-display text-xl font-bold text-brand-ink">{v}</dd></div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="src-h">
            <h2 id="src-h" className="font-display text-lg font-semibold text-brand-ink">Where they came from</h2>
            <FunnelTable first="Link source" rows={data.sources.map((s) => ({ key: s.label, name: s.label, f: s.funnel }))} testid="sources" />
          </section>

          {data.courses.length > 1 && (
            <section aria-labelledby="crs-h">
              <h2 id="crs-h" className="font-display text-lg font-semibold text-brand-ink">By course</h2>
              <FunnelTable first="Course" rows={data.courses.map((x) => ({ key: x.courseId, name: x.organization ? `${x.title} · ${x.organization}` : x.title, f: x.funnel }))} testid="courses" />
            </section>
          )}

          <section aria-labelledby="com-h" className="space-y-3">
            <h2 id="com-h" className="font-display text-lg font-semibold text-brand-ink">Commission ledger</h2>
            <p className="max-w-2xl text-sm text-gray-600">Each payment that came through a campaign for an organization&apos;s course, counted once, at the organization&apos;s rate on the day it was paid. This lists payments made in the period.</p>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4" data-testid="commission-tiles">
              {[["Payments from campaigns", `${c.summary.payments} · ${naira(c.summary.amountKobo)}`], ["Commission earned", naira(c.summary.earnedKobo)], ["Owed to AAICBI", naira(c.summary.owedKobo)], ["Settled", naira(c.summary.settledKobo)]].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-brand-surface p-3"><dt className="text-xs text-gray-600">{k}</dt><dd className="font-display text-lg font-bold text-brand-ink">{v}</dd></div>
              ))}
            </dl>
            {c.summary.reversedCount > 0 && <p className="text-sm text-gray-600">{c.summary.reversedCount} reversed ({naira(c.summary.reversedKobo)}), not counted above.</p>}
            {c.rates.length > 0 && <p className="text-sm text-brand-ink" data-testid="rates">{isSuper ? "Rates: " : "Your rate: "}{c.rates.map((r) => `${r.name} ${r.percent === null ? "not set" : `${r.percent}%`}`).join(" · ")}</p>}
            {c.unrated.count > 0 && <p className="rounded-xl bg-brand-goldLight p-3 text-sm text-brand-goldText" data-testid="unrated">{c.unrated.count} {c.unrated.count === 1 ? "payment" : "payments"} ({naira(c.unrated.amountKobo)}) came through a campaign for an organization with no commission rate, so {c.unrated.count === 1 ? "it is" : "they are"} not in the ledger. {isSuper ? "Set the organization's rate on the Growth page and they are added." : "Ask AAICBI about your rate."}</p>}

            {isSuper && owedRows.length > 0 && (
              <div className="rounded-2xl border border-brand-gray/60 bg-brand-surface p-4" data-testid="settle-bar">
                <label htmlFor="settle-note" className="block text-sm font-semibold text-brand-ink">Payment reference or note (optional)</label>
                <input id="settle-note" maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example, the bank transfer reference" className="mt-1 min-h-[44px] w-full rounded-lg border border-brand-gray bg-brand-surface px-3 text-base text-brand-ink" data-testid="settle-note" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy || picked.size === 0} onClick={() => act({ action: "settle", ids: [...picked], note }, "Marked settled.")} className="min-h-[44px] rounded-full bg-brand-action px-5 text-sm font-bold text-brand-onAccent hover:bg-brand-actionHover disabled:opacity-60" data-testid="settle-selected">Mark {picked.size || ""} selected as settled</button>
                  {org !== "all" && org !== "aaicbi" && <button type="button" disabled={busy} onClick={() => act({ action: "settle", organizationId: org, note }, "Marked settled.")} className="min-h-[44px] rounded-full border border-brand-action px-5 text-sm font-semibold text-brand-action hover:bg-brand-mint disabled:opacity-60" data-testid="settle-org">Settle everything this organization owes</button>}
                </div>
              </div>
            )}
            {problem && <p className="text-sm text-brand-rose" role="alert">{problem}</p>}

            {c.ledger.length === 0 ? <p className="text-sm text-gray-600">No payments from campaigns in this period yet.</p> : (
              <>
                <ul className="space-y-2" data-testid="ledger">
                  {c.ledger.map((r) => (
                    <li key={r.id} className="rounded-xl border border-brand-gray/60 bg-brand-surface p-3" data-testid="ledger-row">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          {isSuper && <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" disabled={r.status !== "OWED"} checked={picked.has(r.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(r.id); else n.delete(r.id); setPicked(n); }} aria-label={`Select the payment by ${r.trainee}`} data-testid="ledger-pick" />}
                          <div className="min-w-0"><p className="font-semibold text-brand-ink">{r.trainee} · {r.course}</p><p className="text-xs text-gray-600">{new Date(r.paidAt).toLocaleDateString()} · {r.source}{r.organization ? ` · ${r.organization}` : ""}{r.reference ? ` · ${r.reference}` : ""}</p></div>
                        </div>
                        <Badge variant={STATUS_VARIANT[r.status]}>{LEDGER_LABEL[r.status]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-brand-ink">{naira(r.amountKobo)} at {r.rateBps / 100}% = <span className="font-bold">{naira(r.commissionKobo)}</span></p>
                      {r.note && <p className="mt-1 text-sm text-gray-600">{r.note}</p>}
                      {isSuper && r.status !== "REVERSED" && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {r.status === "SETTLED" && <button type="button" disabled={busy} onClick={() => act({ action: "reopen", id: r.id }, "Reopened.")} className="min-h-[36px] rounded-full border border-brand-gray px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint disabled:opacity-60">Reopen</button>}
                          {reversing === r.id ? (
                            <>
                              <input aria-label="Why it is reversed" maxLength={NOTE_MAX} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why, for example the refund reference" className="min-h-[36px] min-w-0 flex-1 rounded-lg border border-brand-gray bg-brand-surface px-3 text-sm text-brand-ink" data-testid="reverse-reason" />
                              <button type="button" disabled={busy} onClick={() => act({ action: "reverse", id: r.id, note: reason }, "Reversed.")} className="min-h-[36px] rounded-full border border-brand-rose bg-brand-roseLight px-3 text-sm font-bold text-brand-rose disabled:opacity-60" data-testid="reverse-confirm">Reverse</button>
                            </>
                          ) : <button type="button" onClick={() => { setReversing(r.id); setReason(""); }} className="min-h-[36px] rounded-full border border-brand-gray px-3 text-sm font-semibold text-brand-ink hover:bg-brand-mint" data-testid="reverse-open">Reverse (refunded)</button>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {c.ledgerTotal > c.ledgerShown && <p className="text-sm text-gray-600">Showing the latest {c.ledgerShown} of {c.ledgerTotal}. The download has everything.</p>}
              </>
            )}
            {isSuper && <p className="text-xs text-gray-600">Reversing is done by hand: refund the payment in Paystack first, then reverse it here. This app does not see refunds.</p>}
          </section>
        </>
      )}
    </div>
  );
}

function FunnelTable({ first, rows, testid }: { first: string; rows: { key: string; name: string; f: FunnelCounts }[]; testid: string }) {
  if (rows.length === 0) return <p className="mt-1 text-sm text-gray-600">Nothing yet.</p>;
  return (
    <div className="mt-2 overflow-x-auto rounded-xl border border-brand-gray/60 bg-brand-surface" data-testid={testid}>
      <table className="w-full min-w-[560px] text-sm text-brand-ink">
        <thead><tr className="text-left text-xs uppercase tracking-wide text-gray-600"><th className="p-3 font-semibold">{first}</th><th className="p-3 text-right font-semibold">Started</th><th className="p-3 text-right font-semibold">Finished</th><th className="p-3 text-right font-semibold">Saved</th><th className="p-3 text-right font-semibold">Module 1</th><th className="p-3 text-right font-semibold">Passed</th><th className="p-3 text-right font-semibold">Paid</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key} className="border-t border-brand-gray/40"><td className="p-3 font-semibold">{r.name}</td>{(["started", "finished", "saved", "startedModule1", "passedModule1", "paid"] as const).map((k) => <td key={k} className="p-3 text-right tabular-nums">{r.f[k]}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

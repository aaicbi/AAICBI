/**
 * Analytics System Phase 4 — configurable admin alerts (master spec
 * Section 32), called only from the new
 * /api/cron/analytics-alerts cron route. Four fixed rules, not an
 * admin-tunable UI — same "named constants over a configurable system"
 * trim as every prior phase. Reuses getAutomatedInsights/getSearchDemand
 * rather than re-deriving any numbers — this file is purely the
 * "which of these already-computed facts is alert-worthy, and who to
 * tell" layer.
 *
 * A tighter 7-day window than the dashboard's own 30-day default for
 * Automated Insights — an alert exists to be TIMELY ("something
 * changed recently enough to act on"), not a monthly retrospective.
 *
 * No persisted de-duplication table — the daily cron cadence itself is
 * the natural throttle (this can fire at most once per real day under
 * normal operation), consistent with this phase's own "don't add
 * infrastructure the platform doesn't need yet" discipline.
 */
import { getAutomatedInsights } from "@/lib/analytics/insights";
import { getSearchDemand, type PeriodRange } from "@/lib/analytics/aggregate";
import { notifyAllAdminStaff } from "@/lib/notifications/notifyAllAdminStaff";

const ALERT_WINDOW_DAYS = 7;
const ZERO_RESULT_ALERT_THRESHOLD = 3;

export interface AlertCheckResult {
  fired: string[];
}

export async function checkAndSendAlerts(now: Date = new Date()): Promise<AlertCheckResult> {
  const fired: string[] = [];
  const insights = await getAutomatedInsights(ALERT_WINDOW_DAYS, now);

  const registrations = insights.find((i) => i.type === "REGISTRATIONS");
  if (registrations && typeof registrations.evidence.changePercent === "number" && registrations.evidence.changePercent < 0) {
    await sendAlert("Registrations have dropped", registrations.summary, registrations.evidence);
    fired.push("REGISTRATIONS_DROPPED");
  }

  const conversion = insights.find((i) => i.type === "CONVERSION_RATE");
  if (conversion && typeof conversion.evidence.pointChange === "number" && conversion.evidence.pointChange < 0) {
    await sendAlert("The completion/conversion rate has decreased", conversion.summary, conversion.evidence);
    fired.push("CONVERSION_RATE_DROPPED");
  }

  // TOP_COURSE_GROWTH only ever represents growth (insights.ts filters
  // out decline before this type is ever produced) — the positive
  // counterpart Section 32's own example list explicitly includes
  // ("interest in a topic has increased significantly"), not just drops.
  const topCourseGrowth = insights.find((i) => i.type === "TOP_COURSE_GROWTH");
  if (topCourseGrowth) {
    await sendAlert("Interest in a course has increased significantly", topCourseGrowth.summary, topCourseGrowth.evidence);
    fired.push("TOPIC_INTEREST_SURGED");
  }

  const period: PeriodRange = { start: new Date(now.getTime() - ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000), end: now };
  const searchDemand = await getSearchDemand(period);
  if (searchDemand && searchDemand.zeroResultQueries.length >= ZERO_RESULT_ALERT_THRESHOLD) {
    const examples = searchDemand.zeroResultQueries.slice(0, 5).map((q) => q.query).join(", ");
    const summary = `${searchDemand.zeroResultQueries.length} different searches in the last ${ALERT_WINDOW_DAYS} days found no matching courses — real, unmet demand. Examples: ${examples}.`;
    await sendAlert("Users are searching for content that doesn't exist", summary, {
      zeroResultQueryCount: searchDemand.zeroResultQueries.length,
    });
    fired.push("ZERO_RESULT_SEARCH_SPIKE");
  }

  return { fired };
}

async function sendAlert(subject: string, summary: string, evidence: Record<string, number | string>): Promise<void> {
  const evidenceText = Object.entries(evidence)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  await notifyAllAdminStaff(
    "ANALYTICS_ALERT",
    undefined,
    {
      subject: `AAICBI Analytics Alert: ${subject}`,
      html: `<p>${summary}</p><p style="color:#888;font-size:12px;">${evidenceText}</p>`,
      text: `${summary}\n\n${evidenceText}`,
    },
    "/admin/analytics"
  );
}

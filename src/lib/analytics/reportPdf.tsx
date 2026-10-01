/**
 * Analytics System Phase 5 — the PDF report, built from the exact
 * pattern src/lib/performancePdf.tsx already established (same
 * @react-pdf/renderer primitives, same brand hex constants — react-pdf
 * can't consume CSS variables — same renderToBuffer, generated fresh
 * per request/cron run with no persistence). No chart library: this
 * codebase's own house style for react-pdf is stat grids and tables,
 * confirmed by that same file, not SVG/recharts — followed here rather
 * than invented fresh.
 *
 * Takes the exact same shape GET /api/admin/analytics already returns
 * (plus `days`/`generatedAt`) — no new aggregation, purely a rendering
 * layer. A section renders nothing at all when its data is null (the
 * INSTRUCTOR-scoped case), never an empty/misleading block.
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { PlatformOverview, FunnelStage, CoursePerformanceRow, FeatureUsageRow } from "@/lib/analytics/aggregate";
import type { PlatformInterestSummary } from "@/lib/analytics/interestScoring";
import type { SegmentSummary } from "@/lib/analytics/segments";
import type { CohortRow } from "@/lib/analytics/cohorts";
import type { Insight } from "@/lib/analytics/insights";

export interface AnalyticsReportData {
  days: number;
  generatedAt: Date;
  overview: PlatformOverview;
  funnel: FunnelStage[];
  coursePerformance: CoursePerformanceRow[];
  featureUsage: FeatureUsageRow[];
  interestSummary: PlatformInterestSummary | null;
  segments: SegmentSummary[] | null;
  cohorts: CohortRow[] | null;
  insights: Insight[] | null;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 8.5, color: "#16302B" },
  brand: { fontSize: 9, color: "#016B61", fontWeight: 700, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#4B5563", marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#016B61", marginTop: 16, marginBottom: 6 },
  sectionNote: { fontSize: 7.5, color: "#6B7280", marginBottom: 6 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6, gap: 6 },
  kpiItem: { width: "19%", marginBottom: 8 },
  kpiLabel: { fontSize: 7, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  insightRow: { backgroundColor: "#E6F4F1", borderRadius: 2, padding: 6, marginBottom: 4 },
  insightText: { fontSize: 8 },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#016B61", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#D9D9D9", paddingVertical: 3 },
  headerCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#016B61", textTransform: "uppercase" },
  cell: { fontSize: 7.5 },
  funnelBarTrack: { height: 8, backgroundColor: "#F0F0F0", borderRadius: 2, marginTop: 2, marginBottom: 6 },
  funnelBarFill: { height: 8, backgroundColor: "#016B61", borderRadius: 2 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#9CA3AF", textAlign: "center", borderTopWidth: 1, borderTopColor: "#D9D9D9", paddingTop: 6 },
  pageNumber: { position: "absolute", bottom: 24, right: 40, fontSize: 7.5, color: "#9CA3AF" },
});

function col(width: string) {
  return { width };
}

function AnalyticsReportDocument({ data }: { data: AnalyticsReportData }) {
  const maxFunnelCount = data.funnel[0]?.count || 1;

  return (
    <Document title={`AAICBI Analytics Report — Last ${data.days} Days`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>AAICBI LEARNING MANAGEMENT SYSTEM</Text>
        <Text style={styles.title}>Analytics Report</Text>
        <Text style={styles.subtitle}>
          Last {data.days} days · Generated {data.generatedAt.toLocaleString()}
        </Text>

        {/* Executive Summary — the Automated Insights list. Doubles as
            the "recommendations" section: an insight already states
            what changed and is evidence-backed. */}
        {data.insights && data.insights.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Executive Summary</Text>
            <Text style={styles.sectionNote}>This period vs. the immediately-preceding period — a behavioural association, not a causal claim.</Text>
            {data.insights.map((insight) => (
              <View key={insight.type} style={styles.insightRow} wrap={false}>
                <Text style={styles.insightText}>{insight.summary}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Platform Overview */}
        <Text style={styles.sectionTitle}>Platform Overview</Text>
        <View style={styles.kpiGrid}>
          {data.overview.registeredUsers !== null && (
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Registered Users</Text>
              <Text style={styles.kpiValue}>{data.overview.registeredUsers}</Text>
            </View>
          )}
          {data.overview.newRegistrations !== null && (
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>New Registrations</Text>
              <Text style={styles.kpiValue}>{data.overview.newRegistrations}</Text>
            </View>
          )}
          {data.overview.currentlyActive !== null && (
            <View style={styles.kpiItem}>
              <Text style={styles.kpiLabel}>Currently Active</Text>
              <Text style={styles.kpiValue}>{data.overview.currentlyActive}</Text>
            </View>
          )}
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Enrollments</Text>
            <Text style={styles.kpiValue}>{data.overview.enrollments}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Completions</Text>
            <Text style={styles.kpiValue}>{data.overview.completions}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Conversion Rate</Text>
            <Text style={styles.kpiValue}>{data.overview.conversionRate != null ? `${data.overview.conversionRate}%` : "—"}</Text>
          </View>
        </View>

        {/* Conversion Funnel */}
        <Text style={styles.sectionTitle}>Conversion Funnel</Text>
        {data.funnel.map((stage, i) => (
          <View key={stage.label} wrap={false}>
            <Text style={styles.cell}>
              {stage.label}: {stage.count}
              {i > 0 && stage.percentOfPrevious != null ? ` (${stage.percentOfPrevious}%)` : ""}
            </Text>
            <View style={styles.funnelBarTrack}>
              <View style={[styles.funnelBarFill, { width: `${Math.max(2, (stage.count / maxFunnelCount) * 100)}%` }]} />
            </View>
          </View>
        ))}

        {/* Content Performance */}
        {data.coursePerformance.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Content Performance</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.headerCell, col("28%")]}>Course</Text>
                <Text style={[styles.headerCell, col("12%")]}>Views</Text>
                <Text style={[styles.headerCell, col("14%")]}>Anon. Views</Text>
                <Text style={[styles.headerCell, col("15%")]}>Enrollments</Text>
                <Text style={[styles.headerCell, col("15%")]}>Completions</Text>
                <Text style={[styles.headerCell, col("16%")]}>Completion Rate</Text>
              </View>
              {data.coursePerformance.slice(0, 15).map((c) => (
                <View key={c.courseId} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.cell, col("28%")]}>{c.title}</Text>
                  <Text style={[styles.cell, col("12%")]}>{c.views}</Text>
                  <Text style={[styles.cell, col("14%")]}>{c.anonymousViews}</Text>
                  <Text style={[styles.cell, col("15%")]}>{c.enrollments}</Text>
                  <Text style={[styles.cell, col("15%")]}>{c.completions}</Text>
                  <Text style={[styles.cell, col("16%")]}>{c.completionRate != null ? `${c.completionRate}%` : "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Feature Usage */}
        {data.featureUsage.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Feature Usage</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.headerCell, col("50%")]}>Feature</Text>
                <Text style={[styles.headerCell, col("25%")]}>Total Uses</Text>
                <Text style={[styles.headerCell, col("25%")]}>Unique Users</Text>
              </View>
              {data.featureUsage.map((f) => (
                <View key={f.feature} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.cell, col("50%")]}>{f.feature}</Text>
                  <Text style={[styles.cell, col("25%")]}>{f.totalUses}</Text>
                  <Text style={[styles.cell, col("25%")]}>{f.uniqueUsers}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interest Intelligence */}
        {data.interestSummary && (data.interestSummary.topTopics.length > 0 || data.interestSummary.emergingTopics.length > 0) && (
          <View>
            <Text style={styles.sectionTitle}>Interest Intelligence</Text>
            {data.interestSummary.topTopics.length > 0 && (
              <Text style={styles.cell}>
                Most popular: {data.interestSummary.topTopics.slice(0, 8).map((t) => `${t.topic} (${t.traineeCount})`).join(", ")}
              </Text>
            )}
            {data.interestSummary.emergingTopics.length > 0 && (
              <Text style={[styles.cell, { marginTop: 3 }]}>
                Emerging: {data.interestSummary.emergingTopics.slice(0, 8).map((t) => `${t.topic} (${t.traineeCount})`).join(", ")}
              </Text>
            )}
          </View>
        )}

        {/* Segments */}
        {data.segments && data.segments.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Segments</Text>
            {data.segments.map((s) => (
              <Text key={s.key} style={styles.cell}>
                {s.label}: {s.count}
              </Text>
            ))}
          </View>
        )}

        {/* Cohorts */}
        {data.cohorts && data.cohorts.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Cohorts — by registration week</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.headerCell, col("22%")]}>Week</Text>
                <Text style={[styles.headerCell, col("18%")]}>Size</Text>
                <Text style={[styles.headerCell, col("18%")]}>Active</Text>
                <Text style={[styles.headerCell, col("18%")]}>Completed</Text>
                <Text style={[styles.headerCell, col("24%")]}>Top Source</Text>
              </View>
              {data.cohorts.map((c) => (
                <View key={c.weekStart} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.cell, col("22%")]}>{c.weekStart}</Text>
                  <Text style={[styles.cell, col("18%")]}>{c.size}</Text>
                  <Text style={[styles.cell, col("18%")]}>{c.activeCount}</Text>
                  <Text style={[styles.cell, col("18%")]}>{c.completedCount}</Text>
                  <Text style={[styles.cell, col("24%")]}>{c.topReferrerSource ?? "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generated by AAICBI LMS — behavioural data only; a correlation, never a causal claim.
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function renderAnalyticsReportPdf(data: AnalyticsReportData): Promise<Buffer> {
  return renderToBuffer(<AnalyticsReportDocument data={data} />);
}

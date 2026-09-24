/**
 * Trainee Performance Dashboard — PDF export. Modeled directly on
 * curriculumPdf.tsx (the one existing PDF utility in this codebase):
 * same @react-pdf/renderer primitives, same brand hex constants
 * (react-pdf can't consume CSS variables, so these are the resolved
 * light-mode values from globals.css), generated fresh per request
 * with no persistence.
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { TraineePerformanceRow, PerformanceKpis } from "@/lib/performanceDashboard";

const TREND_LABEL: Record<string, string> = { improving: "Improving", declining: "Declining", flat: "Flat", "insufficient-data": "Insufficient data" };
const CERT_LABEL: Record<string, string> = { ISSUED: "Issued", REVOKED: "Revoked", NOT_YET: "Not yet" };

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 8.5, color: "#16302B" },
  brand: { fontSize: 9, color: "#016B61", fontWeight: 700, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#4B5563", marginBottom: 14 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18, gap: 6 },
  kpiItem: { width: "19%", marginBottom: 8 },
  kpiLabel: { fontSize: 7, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  table: { marginTop: 8 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#016B61", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#D9D9D9", paddingVertical: 3 },
  headerCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#016B61", textTransform: "uppercase" },
  cell: { fontSize: 7.5 },
  colName: { width: "18%" },
  colProgress: { width: "10%" },
  colScore: { width: "8%" },
  colAttempts: { width: "8%" },
  colTrend: { width: "9%" },
  colCert: { width: "9%" },
  colStatus: { width: "9%" },
  atRiskLabel: { color: "#B23A48", fontFamily: "Helvetica-Bold" },
  onTrackLabel: { color: "#016B61" },
  completedLabel: { color: "#8A5F1F" },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#9CA3AF", textAlign: "center", borderTopWidth: 1, borderTopColor: "#D9D9D9", paddingTop: 6 },
});

function statusStyle(status: string) {
  if (status === "AT_RISK") return styles.atRiskLabel;
  if (status === "COMPLETED") return styles.completedLabel;
  return styles.onTrackLabel;
}

const STATUS_LABEL: Record<string, string> = { ON_TRACK: "On Track", AT_RISK: "At Risk", COMPLETED: "Completed" };

function pct(value: number | null): string {
  return value != null ? `${Math.round(value)}%` : "—";
}

function PerformanceDocument({ courseTitle, kpis, rows }: { courseTitle: string; kpis: PerformanceKpis; rows: TraineePerformanceRow[] }) {
  return (
    <Document title={`${courseTitle} — Trainee Performance Report`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.brand}>AAICBI LEARNING MANAGEMENT SYSTEM</Text>
        <Text style={styles.title}>{courseTitle}</Text>
        <Text style={styles.subtitle}>Trainee Performance Report</Text>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Total Trainees</Text>
            <Text style={styles.kpiValue}>{kpis.totalTrainees}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Avg. Completion</Text>
            <Text style={styles.kpiValue}>{kpis.averageCompletionPct}%</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Avg. Assessment Score</Text>
            <Text style={styles.kpiValue}>{pct(kpis.averageAssessmentScore)}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>At Risk</Text>
            <Text style={styles.kpiValue}>{kpis.atRiskCount}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Certification Rate</Text>
            <Text style={styles.kpiValue}>{kpis.certificationRate}%</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.headerCell, styles.colName]}>Trainee</Text>
            <Text style={[styles.headerCell, styles.colProgress]}>Progress</Text>
            <Text style={[styles.headerCell, styles.colScore]}>First</Text>
            <Text style={[styles.headerCell, styles.colScore]}>Best</Text>
            <Text style={[styles.headerCell, styles.colScore]}>Latest</Text>
            <Text style={[styles.headerCell, styles.colScore]}>Average</Text>
            <Text style={[styles.headerCell, styles.colAttempts]}>Attempts</Text>
            <Text style={[styles.headerCell, styles.colTrend]}>Trend</Text>
            <Text style={[styles.headerCell, styles.colCert]}>Certification</Text>
            <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
          </View>
          {rows.map((r) => (
            <View key={r.traineeId} style={styles.tableRow} wrap={false}>
              <Text style={[styles.cell, styles.colName]}>{r.name}</Text>
              <Text style={[styles.cell, styles.colProgress]}>{`${r.completedModules}/${r.totalModules} (${r.completionPct}%)`}</Text>
              <Text style={[styles.cell, styles.colScore]}>{pct(r.firstScore)}</Text>
              <Text style={[styles.cell, styles.colScore]}>{pct(r.bestScore)}</Text>
              <Text style={[styles.cell, styles.colScore]}>{pct(r.latestScore)}</Text>
              <Text style={[styles.cell, styles.colScore]}>{pct(r.averageScore)}</Text>
              <Text style={[styles.cell, styles.colAttempts]}>{r.totalAttempts}</Text>
              <Text style={[styles.cell, styles.colTrend]}>{TREND_LABEL[r.trend]}</Text>
              <Text style={[styles.cell, styles.colCert]}>{CERT_LABEL[r.certificationStatus]}</Text>
              <Text style={[styles.cell, styles.colStatus, statusStyle(r.overallStatus)]}>{STATUS_LABEL[r.overallStatus]}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer} fixed>
          Generated by AAICBI LMS — data reflects course progress, assessment attempts, and certification status only.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPerformancePdf(courseTitle: string, kpis: PerformanceKpis, rows: TraineePerformanceRow[]): Promise<Buffer> {
  return renderToBuffer(<PerformanceDocument courseTitle={courseTitle} kpis={kpis} rows={rows} />);
}

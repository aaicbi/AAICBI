/**
 * Dashboard/Examination redesign — a trainee's own downloadable
 * learning report, built from the exact @react-pdf/renderer pattern
 * already established by src/lib/analytics/reportPdf.tsx (same brand
 * hex constants, same stat-grid/table primitives, same renderToBuffer,
 * generated fresh per request with no persistence). Single consumer
 * (GET /api/trainee/my-activity/report.pdf), so — unlike the admin
 * report's separate reportData.ts (justified there by three real
 * consumers: JSON route, PDF route, weekly cron) — the data-gathering
 * step lives in this same file rather than being split out for no
 * second caller to share it with.
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getModuleLockMap } from "@/lib/progress";
import { computeStreakDays } from "@/lib/analytics/streakCore";

export interface TraineeReportData {
  traineeName: string;
  generatedAt: Date;
  coursesStarted: number;
  coursesCompleted: number;
  lessonsCompleted: number;
  currentStreakDays: number;
  assessmentStats: {
    totalAttempts: number;
    totalPassed: number;
    totalFailed: number;
    averageScorePercent: number | null;
    highestScorePercent: number | null;
  };
  courseProgress: { courseTitle: string; completedModules: number; totalModules: number; percentComplete: number }[];
  certificates: { courseTitle: string; issuedAt: Date }[];
}

const STREAK_LOOKBACK_DAYS = 60;

export async function getTraineeReportData(traineeId: string): Promise<TraineeReportData> {
  const trainee = await prisma.trainee.findUniqueOrThrow({ where: { id: traineeId }, select: { name: true } });

  const [coursesStarted, coursesCompleted, lessonsCompleted, submittedAttempts, recentEvents, certificates] =
    await Promise.all([
      prisma.courseEnrollment.count({ where: { traineeId, unlockedAt: { not: null } } }),
      prisma.courseEnrollment.count({ where: { traineeId, completedAt: { not: null } } }),
      prisma.lessonProgress.count({ where: { traineeId } }),
      prisma.attempt.findMany({ where: { traineeId, status: "SUBMITTED" }, select: { percentage: true, passed: true } }),
      prisma.analyticsEvent.findMany({
        where: { userId: traineeId, recipientType: "TRAINEE", createdAt: { gte: new Date(Date.now() - STREAK_LOOKBACK_DAYS * 86400000) } },
        select: { createdAt: true },
      }),
      prisma.certificate.findMany({
        where: { traineeId, revokedAt: null },
        select: { issuedAt: true, course: { select: { title: true } } },
        orderBy: { issuedAt: "desc" },
      }),
    ]);

  const scored = submittedAttempts.filter((a) => a.percentage != null);
  const assessmentStats = {
    totalAttempts: submittedAttempts.length,
    totalPassed: submittedAttempts.filter((a) => a.passed === true).length,
    totalFailed: submittedAttempts.filter((a) => a.passed === false).length,
    averageScorePercent:
      scored.length === 0 ? null : Math.round(scored.reduce((sum, a) => sum + (a.percentage ?? 0), 0) / scored.length),
    highestScorePercent: scored.length === 0 ? null : Math.round(Math.max(...scored.map((a) => a.percentage ?? 0))),
  };

  // Same "which courses has this trainee actually started" shape as
  // GET /api/trainee/progress and the dashboard's own query — an
  // accepted, already-documented duplication in this codebase (see
  // either of those files' own comments) rather than a third shared
  // extraction for one more caller.
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { traineeId, unlockedAt: { not: null } },
    select: { courseId: true },
  });
  const courses = await prisma.course.findMany({
    where: { id: { in: enrollments.map((e) => e.courseId) } },
    select: { id: true, title: true, modules: { select: { id: true } } },
  });
  const courseProgress = await Promise.all(
    courses.map(async (course) => {
      const lockMap = await getModuleLockMap(course.id, traineeId);
      const totalModules = course.modules.length;
      const completedModules = Object.values(lockMap).filter((m) => m.completed).length;
      return {
        courseTitle: course.title,
        completedModules,
        totalModules,
        percentComplete: totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100),
      };
    })
  );

  return {
    traineeName: trainee.name,
    generatedAt: new Date(),
    coursesStarted,
    coursesCompleted,
    lessonsCompleted,
    currentStreakDays: computeStreakDays(recentEvents.map((e) => e.createdAt)),
    assessmentStats,
    courseProgress,
    certificates: certificates.map((c) => ({ courseTitle: c.course.title, issuedAt: c.issuedAt })),
  };
}

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 8.5, color: "#16302B" },
  brand: { fontSize: 9, color: "#016B61", fontWeight: 700, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#4B5563", marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#016B61", marginTop: 16, marginBottom: 6 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6, gap: 6 },
  kpiItem: { width: "23%", marginBottom: 8 },
  kpiLabel: { fontSize: 7, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#016B61", paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#D9D9D9", paddingVertical: 3 },
  headerCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#016B61", textTransform: "uppercase" },
  cell: { fontSize: 7.5 },
  progressTrack: { height: 6, backgroundColor: "#F0F0F0", borderRadius: 2, marginTop: 2 },
  progressFill: { height: 6, backgroundColor: "#016B61", borderRadius: 2 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: "#9CA3AF", textAlign: "center", borderTopWidth: 1, borderTopColor: "#D9D9D9", paddingTop: 6 },
  pageNumber: { position: "absolute", bottom: 24, right: 40, fontSize: 7.5, color: "#9CA3AF" },
});

function col(width: string) {
  return { width };
}

function TraineeReportDocument({ data }: { data: TraineeReportData }) {
  return (
    <Document title={`${data.traineeName} — AAICBI Learning Report`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>AAICBI LEARNING MANAGEMENT SYSTEM</Text>
        <Text style={styles.title}>Learning Report — {data.traineeName}</Text>
        <Text style={styles.subtitle}>Generated {data.generatedAt.toLocaleString()}</Text>

        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Courses Started</Text>
            <Text style={styles.kpiValue}>{data.coursesStarted}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Courses Completed</Text>
            <Text style={styles.kpiValue}>{data.coursesCompleted}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Lessons Completed</Text>
            <Text style={styles.kpiValue}>{data.lessonsCompleted}</Text>
          </View>
          <View style={styles.kpiItem}>
            <Text style={styles.kpiLabel}>Current Streak</Text>
            <Text style={styles.kpiValue}>
              {data.currentStreakDays} day{data.currentStreakDays === 1 ? "" : "s"}
            </Text>
          </View>
        </View>

        {data.assessmentStats.totalAttempts > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Assessment Performance</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Passed</Text>
                <Text style={styles.kpiValue}>{data.assessmentStats.totalPassed}</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Failed</Text>
                <Text style={styles.kpiValue}>{data.assessmentStats.totalFailed}</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Average Score</Text>
                <Text style={styles.kpiValue}>
                  {data.assessmentStats.averageScorePercent != null ? `${data.assessmentStats.averageScorePercent}%` : "—"}
                </Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiLabel}>Highest Score</Text>
                <Text style={styles.kpiValue}>
                  {data.assessmentStats.highestScorePercent != null ? `${data.assessmentStats.highestScorePercent}%` : "—"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {data.courseProgress.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Course Progress</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.headerCell, col("50%")]}>Course</Text>
                <Text style={[styles.headerCell, col("20%")]}>Modules</Text>
                <Text style={[styles.headerCell, col("30%")]}>Progress</Text>
              </View>
              {data.courseProgress.map((c) => (
                <View key={c.courseTitle} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.cell, col("50%")]}>{c.courseTitle}</Text>
                  <Text style={[styles.cell, col("20%")]}>
                    {c.completedModules} of {c.totalModules}
                  </Text>
                  <View style={col("30%")}>
                    <Text style={styles.cell}>{c.percentComplete}%</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${c.percentComplete}%` }]} />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.certificates.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Certificates Earned</Text>
            {data.certificates.map((c) => (
              <Text key={c.courseTitle} style={styles.cell}>
                {c.courseTitle} — issued {c.issuedAt.toLocaleDateString()}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generated by AAICBI LMS — your own learning activity, for your records.
        </Text>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export async function renderTraineeReportPdf(data: TraineeReportData): Promise<Buffer> {
  return renderToBuffer(<TraineeReportDocument data={data} />);
}

/**
 * Coming Soon Courses — the one PDF-generation utility in this
 * codebase. Every other "downloadable document" in this app (course
 * curriculum uploads, résumés, certificates) is either an admin-
 * uploaded file or a print-styled HTML page — nothing here previously
 * assembled a real PDF from structured data server-side. `@react-pdf/
 * renderer` was chosen specifically because it's pure JS/Node (no
 * headless-browser binary like puppeteer+@sparticuz/chromium would
 * need), well within a standard Vercel serverless function's size/time
 * budget, and the standard tool for exactly this "structured document
 * from data" case.
 *
 * Generated on demand, every request — no Blob persistence, no cache-
 * invalidation problem, and it's always in sync with the admin's
 * latest module/lesson edits (unlike an uploaded document, which goes
 * stale the moment the curriculum changes and nobody re-uploads it).
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export interface CurriculumPdfLesson {
  title: string;
  description: string | null;
}
export interface CurriculumPdfModule {
  title: string;
  description: string | null;
  lessons: CurriculumPdfLesson[];
}
export interface CurriculumPdfCourse {
  title: string;
  description: string | null;
  category: string | null;
  level: string | null;
  durationDisplay: string | null;
  trainingFormat: string | null;
  instructorNames: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  registrationDeadline: Date | string | null;
  locationType: string | null;
  venue: string | null;
  isFree: boolean;
  priceKobo: number | null;
  modules: CurriculumPdfModule[];
}

const LEVEL_LABEL: Record<string, string> = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const FORMAT_LABEL: Record<string, string> = { SELF_PACED: "Self-paced / Online", INSTRUCTOR_LED: "Instructor-led", HYBRID: "Hybrid" };
const LOCATION_LABEL: Record<string, string> = { PHYSICAL: "Physical", ONLINE: "Online", HYBRID: "Hybrid" };

function formatDate(value: Date | string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10.5, color: "#16302B" },
  brand: { fontSize: 9, color: "#016B61", fontWeight: 700, letterSpacing: 1, marginBottom: 4 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  description: { fontSize: 10.5, color: "#4B5563", marginBottom: 14, lineHeight: 1.4 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18, gap: 6 },
  metaItem: { width: "33%", marginBottom: 8 },
  metaLabel: { fontSize: 8, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#D9D9D9", paddingBottom: 4 },
  moduleBlock: { marginBottom: 10 },
  moduleTitle: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  moduleDescription: { fontSize: 9.5, color: "#4B5563", marginBottom: 4 },
  lessonRow: { flexDirection: "row", marginLeft: 12, marginBottom: 2 },
  lessonBullet: { width: 10, fontSize: 9.5 },
  lessonTitle: { fontSize: 9.5, flex: 1 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, fontSize: 8, color: "#9CA3AF", textAlign: "center", borderTopWidth: 1, borderTopColor: "#D9D9D9", paddingTop: 8 },
});

function CurriculumDocument({ course }: { course: CurriculumPdfCourse }) {
  return (
    <Document title={`${course.title} — Course Outline`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>AAICBI LEARNING MANAGEMENT SYSTEM</Text>
        <Text style={styles.title}>{course.title}</Text>
        {course.description && <Text style={styles.description}>{course.description}</Text>}

        <View style={styles.metaGrid}>
          {course.category && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Category</Text>
              <Text style={styles.metaValue}>{course.category}</Text>
            </View>
          )}
          {course.level && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Level</Text>
              <Text style={styles.metaValue}>{LEVEL_LABEL[course.level] ?? course.level}</Text>
            </View>
          )}
          {course.durationDisplay && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{course.durationDisplay}</Text>
            </View>
          )}
          {course.trainingFormat && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Format</Text>
              <Text style={styles.metaValue}>{FORMAT_LABEL[course.trainingFormat] ?? course.trainingFormat}</Text>
            </View>
          )}
          {course.instructorNames && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Instructor</Text>
              <Text style={styles.metaValue}>{course.instructorNames}</Text>
            </View>
          )}
          {course.locationType && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Location</Text>
              <Text style={styles.metaValue}>
                {LOCATION_LABEL[course.locationType] ?? course.locationType}
                {course.venue ? ` — ${course.venue}` : ""}
              </Text>
            </View>
          )}
          {formatDate(course.startDate) && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Starts</Text>
              <Text style={styles.metaValue}>{formatDate(course.startDate)}</Text>
            </View>
          )}
          {formatDate(course.endDate) && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Ends</Text>
              <Text style={styles.metaValue}>{formatDate(course.endDate)}</Text>
            </View>
          )}
          {formatDate(course.registrationDeadline) && (
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Registration Deadline</Text>
              <Text style={styles.metaValue}>{formatDate(course.registrationDeadline)}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Price</Text>
            <Text style={styles.metaValue}>
              {course.isFree
                ? "Free"
                : course.priceKobo != null
                  ? (course.priceKobo / 100).toLocaleString("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 })
                  : "Contact us"}
            </Text>
          </View>
        </View>

        {course.modules.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Course Curriculum</Text>
            {course.modules.map((m, i) => (
              <View key={i} style={styles.moduleBlock} wrap={false}>
                <Text style={styles.moduleTitle}>
                  Module {i + 1}: {m.title}
                </Text>
                {m.description && <Text style={styles.moduleDescription}>{m.description}</Text>}
                {m.lessons.map((l, j) => (
                  <View key={j} style={styles.lessonRow}>
                    <Text style={styles.lessonBullet}>{"•"}</Text>
                    <Text style={styles.lessonTitle}>{l.title}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer} fixed>
          Generated by AAICBI LMS — visit the course page to register or check for updates.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderCurriculumPdf(course: CurriculumPdfCourse): Promise<Buffer> {
  return renderToBuffer(<CurriculumDocument course={course} />);
}

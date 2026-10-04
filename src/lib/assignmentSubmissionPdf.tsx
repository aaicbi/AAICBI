/**
 * AI Assignment Engine — the manual-grading fallback: when an
 * assignment has `aiAssessmentEnabled: false`, a submission is never
 * sent to the AI at all. Instead it's rendered as a clean PDF and
 * emailed to the owning instructor(s) to grade by hand. Same tooling
 * choice as every other PDF in this project (@react-pdf/renderer, pure
 * JS, no headless browser) — see instructorAgreementPdf.tsx's own
 * comment for the full reasoning. Generated fresh at submit time, not
 * persisted — the emailed PDF is the durable copy.
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", fontSize: 10, color: "#16302B" },
  masthead: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#016B61", textAlign: "center", letterSpacing: 0.5, marginBottom: 4 },
  subtitle: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: "#16302B", textAlign: "center", marginBottom: 6 },
  meta: { fontSize: 9.5, color: "#4B5563", textAlign: "center", marginBottom: 14 },
  brandRule: { borderBottomWidth: 1.5, borderBottomColor: "#016B61", marginBottom: 18 },
  questionBlock: { marginBottom: 16 },
  questionLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#016B61", marginBottom: 3 },
  questionText: { fontSize: 10, color: "#16302B", lineHeight: 1.4, marginBottom: 2 },
  marksLabel: { fontSize: 8.5, color: "#4B5563", marginBottom: 8 },
  answerLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#4B5563", marginBottom: 3 },
  answerBox: { borderWidth: 1, borderColor: "#D9D9D9", borderRadius: 2, padding: 8, backgroundColor: "#F9FAFB" },
  answerText: { fontSize: 10, color: "#16302B", lineHeight: 1.5 },
  emptyAnswer: { fontSize: 10, color: "#9CA3AF", fontStyle: "italic" },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#9CA3AF",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#D9D9D9",
    paddingTop: 8,
  },
});

export interface SubmissionPdfQuestion {
  questionNumber: string;
  questionText: string;
  maxMarks: number;
  answerText: string | null;
}

function SubmissionDocument({
  assignmentTitle,
  traineeName,
  submittedAtLabel,
  questions,
}: {
  assignmentTitle: string;
  traineeName: string;
  submittedAtLabel: string;
  questions: SubmissionPdfQuestion[];
}) {
  return (
    <Document title={`${assignmentTitle} — ${traineeName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.masthead}>AAICBI — Assignment Submission</Text>
        <Text style={styles.subtitle}>{assignmentTitle}</Text>
        <Text style={styles.meta}>
          Submitted by {traineeName} · {submittedAtLabel}
        </Text>
        <View style={styles.brandRule} />

        {questions.map((q) => (
          <View key={q.questionNumber} style={styles.questionBlock} wrap={false}>
            <Text style={styles.questionLabel}>Question {q.questionNumber}</Text>
            <Text style={styles.questionText}>{q.questionText}</Text>
            <Text style={styles.marksLabel}>{q.maxMarks} marks</Text>
            <Text style={styles.answerLabel}>Student&apos;s answer:</Text>
            <View style={styles.answerBox}>
              {q.answerText?.trim() ? (
                <Text style={styles.answerText}>{q.answerText}</Text>
              ) : (
                <Text style={styles.emptyAnswer}>No answer provided.</Text>
              )}
            </View>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          AAICBI — Africa AI Capacity Building Initiative · For manual grading — AI assessment is disabled for this assignment
        </Text>
      </Page>
    </Document>
  );
}

export async function renderAssignmentSubmissionPdf(input: {
  assignmentTitle: string;
  traineeName: string;
  submittedAt: Date;
  questions: SubmissionPdfQuestion[];
}): Promise<Buffer> {
  const submittedAtLabel = input.submittedAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  return renderToBuffer(
    <SubmissionDocument
      assignmentTitle={input.assignmentTitle}
      traineeName={input.traineeName}
      submittedAtLabel={submittedAtLabel}
      questions={input.questions}
    />
  );
}

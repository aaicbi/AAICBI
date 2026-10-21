import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { RosterRow, TraineeReport } from "./performance";
import { fmtDate, fmtMinutes } from "./performanceCore";

const C = { teal: "#016B61", ink: "#16302B", grey: "#6B7280", line: "#D9D9D9" };
const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 54, fontFamily: "Helvetica", fontSize: 8.5, color: C.ink },
  brand: { fontSize: 8.5, color: C.teal, letterSpacing: 1, marginBottom: 3 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, color: C.grey, marginTop: 2, marginBottom: 6 },
  h: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.teal, marginTop: 14, marginBottom: 5 },
  note: { fontSize: 8, color: C.grey, marginBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  kpi: { width: "25%", marginBottom: 8 },
  kl: { fontSize: 7, color: C.grey, textTransform: "uppercase", marginBottom: 1 },
  kv: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 3 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.teal, paddingBottom: 3, marginBottom: 2 },
  hc: { fontSize: 7, fontFamily: "Helvetica-Bold", color: C.teal, textTransform: "uppercase" },
  c: { fontSize: 8 },
  message: { borderLeftWidth: 2, borderLeftColor: C.teal, paddingLeft: 8, marginVertical: 8, fontSize: 9 },
  foot: { position: "absolute", bottom: 22, left: 36, right: 36, fontSize: 7, color: "#9CA3AF", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
});

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
const Kpi = ({ l, v }: { l: string; v: string | number }) => <View style={s.kpi}><Text style={s.kl}>{l}</Text><Text style={s.kv}>{v}</Text></View>;
type Col = { w: string; t: string };
const Table = ({ cols, rows }: { cols: Col[]; rows: (string | number)[][] }) => (
  <View>
    <View style={s.head}>{cols.map((c) => <Text key={c.t} style={[s.hc, { width: c.w }]}>{c.t}</Text>)}</View>
    {rows.map((r, i) => <View key={i} style={s.row} wrap={false}>{r.map((v, j) => <Text key={j} style={[s.c, { width: cols[j].w }]}>{String(v)}</Text>)}</View>)}
  </View>
);
const Footer = ({ text }: { text: string }) => <View style={s.foot} fixed><Text>{text}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
const Message = ({ text }: { text?: string }) => (text ? <Text style={s.message}>{text}</Text> : null);

function TraineeDoc({ r, message, from }: { r: TraineeReport; message?: string; from?: string }) {
  const g = r.game, p = r.platform;
  return (
    <Document title={`${r.trainee.name} — Performance report`}>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>AAICBI · TRAINEE PERFORMANCE REPORT</Text>
        <Text style={s.title}>{r.trainee.name}</Text>
        <Text style={s.sub}>{r.trainee.email}{r.trainee.phone ? ` · ${r.trainee.phone}` : ""} · Joined {fmtDate(r.trainee.joinedAt)} · Report generated {fmtDate(r.generatedAt)}{from ? ` · Sent by ${from}` : ""}</Text>
        <Message text={message} />
        <Text style={s.note}>{r.scopeNote}</Text>

        <Text style={s.h}>Summary</Text>
        <View style={s.grid}>
          <Kpi l="Courses" v={r.summary.courses} /><Kpi l="Courses completed" v={r.summary.coursesCompleted} /><Kpi l="Modules completed" v={r.summary.modulesCompleted} /><Kpi l="Lessons done" v={r.summary.lessonsDone} />
          <Kpi l="Assessment attempts" v={r.summary.attempts} /><Kpi l="Assessments passed" v={r.summary.assessmentsPassed} /><Kpi l="Average score" v={pct(r.summary.averageScore)} /><Kpi l="Best score" v={pct(r.summary.bestScore)} />
        </View>

        <Text style={s.h}>Course progress</Text>
        {r.courses.length === 0 ? <Text style={s.c}>Not enrolled in any course in this scope.</Text> : r.courses.map((c) => (
          <View key={c.id} wrap={false} style={{ marginBottom: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9 }}>{c.title} — {c.percent}% ({c.modulesCompleted}/{c.modulesTotal} modules{c.completedAt ? `, completed ${fmtDate(c.completedAt)}` : ""}{c.accessEnded ? ", access ended" : ""})</Text>
            <Table cols={[{ w: "55%", t: "Module" }, { w: "25%", t: "Lessons" }, { w: "20%", t: "Status" }]} rows={c.modules.map((m) => [m.title, `${m.lessonsDone}/${m.lessonsTotal}`, m.completed ? "Completed" : m.locked ? "Locked" : "Open"])} />
          </View>
        ))}

        <Text style={s.h}>Assessments: tries and results</Text>
        {r.assessments.length === 0 ? <Text style={s.c}>No assessment has been submitted yet.</Text> : (
          <Table cols={[{ w: "38%", t: "Assessment" }, { w: "10%", t: "Tries" }, { w: "11%", t: "Best" }, { w: "11%", t: "Latest" }, { w: "11%", t: "Average" }, { w: "19%", t: "Result" }]}
            rows={r.assessments.map((a) => [a.assessment, a.attempts, pct(a.best), pct(a.latest), pct(a.average), a.passed ? `Passed on try ${a.attemptsToPass}` : "Not passed yet"])} />
        )}

        <Text style={s.h}>Every attempt</Text>
        {r.attempts.length === 0 ? <Text style={s.c}>No attempts.</Text> : (
          <Table cols={[{ w: "34%", t: "Assessment" }, { w: "8%", t: "Try" }, { w: "16%", t: "Date" }, { w: "12%", t: "Time taken" }, { w: "12%", t: "Score" }, { w: "18%", t: "Outcome" }]}
            rows={r.attempts.map((a) => [a.assessment, a.attemptNumber, fmtDate(a.startedAt), fmtMinutes(a.startedAt, a.submittedAt), a.submittedAt ? `${a.score ?? "—"}/${a.total ?? "—"} (${pct(a.percentage)})` : "—", a.status !== "SUBMITTED" ? (a.status === "EXPIRED" ? "Timed out" : "In progress") : a.passed ? "Passed" : `Not passed (mark ${a.passMark ?? "—"}%)`])} />
        )}

        <Text style={s.h}>Learning games</Text>
        <View style={s.grid}>
          <Kpi l="Questions played" v={g.played} /><Kpi l="Accuracy" v={pct(g.accuracyPercent)} /><Kpi l="Avg seconds per item" v={g.avgSeconds ?? "—"} /><Kpi l="XP earned" v={g.xp} />
          <Kpi l="Days played" v={g.activeDays} /><Kpi l="Answered too fast" v={g.tooFast} /><Kpi l="Last played" v={fmtDate(g.lastPlayedAt)} />
        </View>
        {g.byFormat.length > 0 && <Table cols={[{ w: "50%", t: "Game type" }, { w: "25%", t: "Played" }, { w: "25%", t: "Accuracy" }]} rows={g.byFormat.map((f) => [f.format.charAt(0) + f.format.slice(1).toLowerCase(), f.played, pct(f.accuracyPercent)])} />}

        <Text style={s.h}>Engagement on the platform</Text>
        <View style={s.grid}>
          <Kpi l="Engagement" v={p.level} /><Kpi l="Last active" v={fmtDate(p.lastActiveAt)} /><Kpi l="Logins, 30 days" v={p.logins30} /><Kpi l="Logins, 90 days" v={p.logins90} />
          <Kpi l="Active days, 30" v={p.activeDays30} /><Kpi l="Active days, 90" v={p.activeDays90} /><Kpi l="Current streak" v={`${p.streakDays} d`} /><Kpi l="Lessons done, 30 days" v={p.lessonsCompleted30} />
          <Kpi l="Courses viewed, 30 d" v={p.coursesViewed} /><Kpi l="Assessments started" v={p.assessmentsStarted} /><Kpi l="Questions to Loop" v={p.loopQuestions} />
        </View>

        {r.assignments.length > 0 && (<View><Text style={s.h}>Assignments</Text><Table cols={[{ w: "50%", t: "Assignment" }, { w: "15%", t: "Submissions" }, { w: "15%", t: "Best" }, { w: "20%", t: "Status" }]} rows={r.assignments.map((a) => [a.title, a.submissions, pct(a.best), a.latestStatus.replace(/_/g, " ").toLowerCase()])} /></View>)}
        {r.certificates.length > 0 && (<View><Text style={s.h}>Certificates</Text>{r.certificates.map((c) => <Text key={c.courseTitle} style={s.c}>{c.courseTitle} — issued {fmtDate(c.issuedAt)}</Text>)}</View>)}
        <Footer text="AAICBI · Confidential: contains a trainee's personal learning data. Share only with people who need it." />
      </Page>
    </Document>
  );
}

function RosterDoc({ title, rows, message, from }: { title: string; rows: RosterRow[]; message?: string; from?: string }) {
  return (
    <Document title={title}>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.brand}>AAICBI · PERFORMANCE REPORT</Text>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>{rows.length} trainee{rows.length === 1 ? "" : "s"} · Generated {fmtDate(new Date())}{from ? ` · Sent by ${from}` : ""}</Text>
        <Message text={message} />
        <Table cols={[{ w: "17%", t: "Trainee" }, { w: "19%", t: "Email" }, { w: "7%", t: "Courses" }, { w: "9%", t: "Progress" }, { w: "8%", t: "Attempts" }, { w: "8%", t: "Passed" }, { w: "8%", t: "Avg score" }, { w: "8%", t: "Game plays" }, { w: "8%", t: "Game acc." }, { w: "8%", t: "Engagement" }]}
          rows={rows.map((r) => [r.name, r.email, r.courses, pct(r.percent), r.attempts, r.passed, pct(r.average), r.gamePlayed, pct(r.gameAccuracy), `${r.level} (${fmtDate(r.lastActive)})`])} />
        <Footer text="AAICBI · Confidential: contains trainees' personal learning data." />
      </Page>
    </Document>
  );
}

export const renderTraineePdf = (r: TraineeReport, o: { message?: string; from?: string } = {}): Promise<Buffer> => renderToBuffer(<TraineeDoc r={r} message={o.message} from={o.from} />);
export const renderRosterPdf = (title: string, rows: RosterRow[], o: { message?: string; from?: string } = {}): Promise<Buffer> => renderToBuffer(<RosterDoc title={title} rows={rows} message={o.message} from={o.from} />);

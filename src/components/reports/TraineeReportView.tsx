import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { TraineeReport } from "@/lib/reports/performance";
import { fmtDate, fmtMinutes } from "@/lib/reports/performanceCore";

const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)}%`);
const Stat = ({ l, v }: { l: string; v: string | number }) => <div className="rounded-xl border border-brand-gray bg-brand-surface p-3"><p className="text-[11px] uppercase tracking-wide text-gray-500">{l}</p><p className="font-display text-xl font-semibold text-brand-ink">{v}</p></div>;
const Section = ({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) => <Card><h2 className="font-display text-lg font-semibold text-brand-ink">{title}</h2>{note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}<div className="mt-3">{children}</div></Card>;
const Scroll = ({ children }: { children: React.ReactNode }) => <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm">{children}</table></div>;
const Th = ({ children }: { children: React.ReactNode }) => <th className="border-b border-brand-gray py-1.5 pr-3 text-xs font-semibold uppercase text-gray-500">{children}</th>;
const Td = ({ children }: { children: React.ReactNode }) => <td className="border-b border-brand-gray/40 py-1.5 pr-3 align-top">{children}</td>;

/** The full performance report on screen. Used for the trainee's own page, the organization's and instructors' pages. */
export default function TraineeReportView({ r }: { r: TraineeReport }) {
  const g = r.game, p = r.platform, s = r.summary;
  return (
    <div className="space-y-4" data-testid="trainee-report">
      <Section title="Summary" note={r.scopeNote}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat l="Courses" v={s.courses} /><Stat l="Courses completed" v={s.coursesCompleted} /><Stat l="Modules completed" v={s.modulesCompleted} /><Stat l="Lessons done" v={s.lessonsDone} />
          <Stat l="Assessment attempts" v={s.attempts} /><Stat l="Assessments passed" v={s.assessmentsPassed} /><Stat l="Average score" v={pct(s.averageScore)} /><Stat l="Best score" v={pct(s.bestScore)} />
        </div>
      </Section>

      <Section title="Course progress">
        {r.courses.length === 0 ? <p className="text-sm text-gray-600">No enrolment in this scope.</p> : r.courses.map((c) => (
          <details key={c.id} className="mb-2 rounded-xl border border-brand-gray p-3" open={r.courses.length === 1}>
            <summary className="cursor-pointer font-semibold text-brand-ink">{c.title} <span className="font-normal text-gray-600">· {c.percent}% · {c.modulesCompleted}/{c.modulesTotal} modules · enrolled {fmtDate(c.enrolledAt)}</span> {c.completedAt && <Badge variant="gold">Completed</Badge>} {c.accessEnded && <Badge variant="danger">Access ended</Badge>}</summary>
            <Scroll><thead><tr><Th>Module</Th><Th>Lessons</Th><Th>Status</Th></tr></thead><tbody>{c.modules.map((m) => <tr key={m.title}><Td>{m.title}</Td><Td>{m.lessonsDone}/{m.lessonsTotal}</Td><Td>{m.completed ? <Badge variant="success">Completed</Badge> : m.locked ? <Badge variant="warning">Locked</Badge> : "Open"}</Td></tr>)}</tbody></Scroll>
          </details>
        ))}
      </Section>

      <Section title="Assessments: how many tries" note="Pass mark is 80% unless the course sets another. Only submitted attempts are counted.">
        {r.assessments.length === 0 ? <p className="text-sm text-gray-600">No assessment submitted yet.</p> : (
          <Scroll><thead><tr><Th>Assessment</Th><Th>Tries</Th><Th>Best</Th><Th>Latest</Th><Th>Average</Th><Th>Result</Th></tr></thead><tbody>
            {r.assessments.map((a) => <tr key={a.assessment}><Td>{a.assessment}<br /><span className="text-xs text-gray-500">{a.courseTitle}</span></Td><Td>{a.attempts}</Td><Td>{pct(a.best)}</Td><Td>{pct(a.latest)}</Td><Td>{pct(a.average)}</Td><Td>{a.passed ? <Badge variant="success">Passed on try {a.attemptsToPass}</Badge> : <Badge variant="warning">Not passed yet</Badge>}</Td></tr>)}
          </tbody></Scroll>
        )}
      </Section>

      <Section title="Every attempt">
        {r.attempts.length === 0 ? <p className="text-sm text-gray-600">No attempts.</p> : (
          <Scroll><thead><tr><Th>Assessment</Th><Th>Try</Th><Th>Date</Th><Th>Time taken</Th><Th>Score</Th><Th>Outcome</Th></tr></thead><tbody>
            {r.attempts.map((a, i) => <tr key={i}><Td>{a.assessment}</Td><Td>{a.attemptNumber}</Td><Td>{fmtDate(a.startedAt)}</Td><Td>{fmtMinutes(a.startedAt, a.submittedAt)}</Td><Td>{a.submittedAt ? `${a.score ?? "—"}/${a.total ?? "—"} (${pct(a.percentage)})` : "—"}</Td><Td>{a.status === "EXPIRED" ? "Timed out" : a.status !== "SUBMITTED" ? "In progress" : a.passed ? <Badge variant="success">Passed</Badge> : <Badge variant="danger">Not passed (mark {a.passMark ?? "—"}%)</Badge>}</Td></tr>)}
          </tbody></Scroll>
        )}
      </Section>

      <Section title="Learning games" note="Questions answered in the games for these courses.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat l="Questions played" v={g.played} /><Stat l="Accuracy" v={pct(g.accuracyPercent)} /><Stat l="Avg seconds per item" v={g.avgSeconds ?? "—"} /><Stat l="XP earned" v={g.xp} />
          <Stat l="Days played" v={g.activeDays} /><Stat l="Answered too fast" v={g.tooFast} /><Stat l="Last played" v={fmtDate(g.lastPlayedAt)} />
        </div>
        {g.byFormat.length > 0 && <Scroll><thead><tr><Th>Game type</Th><Th>Played</Th><Th>Accuracy</Th></tr></thead><tbody>{g.byFormat.map((f) => <tr key={f.format}><Td>{f.format.charAt(0) + f.format.slice(1).toLowerCase()}</Td><Td>{f.played}</Td><Td>{pct(f.accuracyPercent)}</Td></tr>)}</tbody></Scroll>}
      </Section>

      <Section title="Engagement on the platform" note="Counted across the platform in the last 90 days.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat l="Engagement" v={p.level} /><Stat l="Last active" v={fmtDate(p.lastActiveAt)} /><Stat l="Logins, 30 days" v={p.logins30} /><Stat l="Logins, 90 days" v={p.logins90} />
          <Stat l="Active days, 30" v={p.activeDays30} /><Stat l="Active days, 90" v={p.activeDays90} /><Stat l="Current streak" v={`${p.streakDays} d`} /><Stat l="Lessons done, 30 d" v={p.lessonsCompleted30} />
          <Stat l="Courses viewed, 30 d" v={p.coursesViewed} /><Stat l="Assessments started" v={p.assessmentsStarted} /><Stat l="Questions to Loop" v={p.loopQuestions} />
        </div>
      </Section>

      {r.assignments.length > 0 && <Section title="Assignments"><Scroll><thead><tr><Th>Assignment</Th><Th>Submissions</Th><Th>Best</Th><Th>Status</Th></tr></thead><tbody>{r.assignments.map((a) => <tr key={a.title}><Td>{a.title}</Td><Td>{a.submissions}</Td><Td>{pct(a.best)}</Td><Td>{a.latestStatus.replace(/_/g, " ").toLowerCase()}</Td></tr>)}</tbody></Scroll></Section>}
      {r.certificates.length > 0 && <Section title="Certificates"><ul className="text-sm">{r.certificates.map((c) => <li key={c.courseTitle}>{c.courseTitle}, issued {fmtDate(c.issuedAt)}</li>)}</ul></Section>}
    </div>
  );
}

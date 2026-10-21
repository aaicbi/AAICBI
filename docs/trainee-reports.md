# Trainee performance reports

One report, built from the same data wherever it is shown (`src/lib/reports/performance.ts`).

**What it holds:** summary; progress per course and module; every assessment with tries, best, latest, average and the try that passed; every attempt (date, time taken, score, outcome); learning-game play (questions, accuracy, seconds per item, XP, days played, answered-too-fast, by game type); platform engagement (logins and active days over 30/90 days, streak, last active, an Engagement level, Loop questions); assignments; certificates.

**Who sees what**
| Who | Where | Scope |
|---|---|---|
| Trainee | `/trainee/performance`, PDF at `/api/trainee/my-activity/report.pdf` | only themselves |
| Training organization (owner and team) | `/admin/organization/trainees`, select a name | trainees enrolled in the organization's own courses; course sections limited to those courses |
| Instructor | `/instructor/trainees` | trainees in the instructor's own courses |
| Super Admin | same APIs | any trainee |

Anyone outside those scopes gets "not found". Login and activity counts are platform-wide numbers; no list of what a trainee did in other organizations' courses is shown.

**Exports and email** (`/api/reports/trainees/…`): `[id]/report.pdf` (one trainee), `export.csv` and `export.pdf` (the roster, optionally `?q=` and `?courseId=`; up to 200 trainees), `POST send` (the PDF by email, to up to 5 addresses, with the sender's message shown above the report and in the email). Sending needs the sender's role to allow writes (organization viewers cannot send), is limited to 20 sends an hour per person, and is recorded in the audit log without the addresses. The email carries no scores itself, only the PDF. CSV cells that start like a formula are defused. Email depends on `RESEND_API_KEY` being set.

**Checks:** `tests/performanceReport.test.ts` (rules) and `scripts/device-checks/trainee-report.cjs` (30 checks over HTTP: access, exports, send validation, pages).

## Organization team roles
The owner adds people under Organization, Team, and gives each a role: **Admin** (everything except billing, including the team), **Instructor**, **Editor** or **Viewer**. An Instructor edits content like an Editor (no publishing, deleting, profile, team or billing) but only in the courses the owner gives them: every change to a module, lesson, material, assessment, question, assignment, cohort or certificate of any other course is refused (`instructorWriteVerdict`, checked on every request in `enforceAndRecord`). They cannot create courses, standalone exams or assignments, share content or change certificate templates, and see only their courses' trainees, reports and exports. They can still look at the organization's other courses. Owners, admins, editors and viewers see all of the organization's trainees. Courses can only be assigned from the organization's own courses. Check: `scripts/device-checks/org-instructors.cjs`.

# AAICBI Knowledge Quest — design (draft 1)

Status: design agreed in conversation, nothing built yet. This is the shared
reference we edit before any code is written. Source idea: "gaming in AAICBI"
(26-page discussion document).

## Principle

A trainee progresses because they show competence, not because they spend time
or collect points. Three things are kept apart and never mixed:

| Thing | What it is | Counts toward certificates? |
| --- | --- | --- |
| Formal result | Score on the formal module assessment, plus mastery gates | Yes |
| Mastery | Verified competence per learning objective | Yes (as gates) |
| XP and game rewards | Practice, persistence, consistency | **No, never** |

## Decisions so far

| # | Decision | Answer |
| --- | --- | --- |
| 1 | Pilot course | AI Automation (content already exists) |
| 2 | First release | Practice mode **and** formal assessment with mastery gates |
| 3 | Practice vs formal questions | **Split pools.** Formal questions are never shown in practice |
| 4 | Practice required before formal | Instructor setting **per module**, default **off** |
| 5 | Reward methods | All available; the **instructor chooses** which are on, per module |
| 6 | Privacy of progress | The trainee chooses who sees it; XP never counts toward a certificate |
| 7 | Leaderboards | Optional **per organization**, switched on by the **organization admin**, public when on |
| 8 | Ranking | Mastery progress and consistency. Not speed, not raw XP |
| 9 | Teams | Parked until the individual system works |

## What the platform already has (reuse, do not rebuild)

- Courses, modules, lessons, materials.
- Per-module confirmed learning objectives (`ModuleLearningObjective`).
- Question bank with AI generation, source-material links and a two-gate
  approval workflow (`QuestionBankStatus`, ends at `APPROVED`).
- Module assessment (`Exam` with `moduleId`): pass mark (default 80), attempts,
  cooldowns, timer, certificates.
- Performance summaries and assignments with learning insights.
- `Badge` only records 25/50/75% course progress. It is not a game layer and
  stays as it is.

## Two modes

**Practice mode**
- Untimed, hints allowed, unlimited attempts.
- Draws only from `APPROVED` questions in the module's **practice pool**.
- A wrong answer explains why and links to the exact source material.
- Earns XP and updates practice mastery. Never touches certificates.

**Formal assessment**
- The existing module assessment, drawing only from the **formal pool**.
- New: **mastery gates**. To pass, the trainee must reach the pass mark **and**
  clear every objective the instructor marks as critical.
- Optional per module: practice mastery must reach a set level before the
  formal assessment unlocks (default off).

**Split pools.** Each approved question carries a pool tag (practice or formal),
set by the instructor at approval. A question is in one pool only. Rules:
the formal assessment never uses a practice question, and practice never shows
a formal question. Each objective needs enough questions in both pools; the
instructor view shows which objectives are short.

## Mastery (separate from XP)

- Tracked per learning objective from verified answers.
- Phase 1 measures **Knowledge**. Application and Reasoning arrive with
  scenario and written questions (later phase); Retention arrives with spaced
  repetition.
- Per objective: attempts, recent accuracy, last practised, state
  (not started / learning / mastered). Mastered needs consistent correct
  answers across separate sessions, not one lucky run.
- Drives: gates, "what to revise next", and the instructor view.

## XP and rewards (instructor chooses what is on, per module)

Available reward rules:
- XP for a correct practice answer.
- Bonus for correctly answering a question missed before.
- Streak days (consistency).
- Mastery badge per objective.
- Module completion badge.
- Level progression: Explorer, Problem Solver, Practitioner, Mastery Challenge.
  Phase 1 reaches Explorer and Problem Solver; the last two need scenario and
  practical content.

Rules: XP is practice-only, caps apply so repeating one easy question cannot
farm points, and nothing here appears on a certificate.

## Privacy

- Per trainee: **only me**, **my instructors and organization**, or **public**.
  Default is **only me**.
- A leaderboard lists only trainees whose setting allows it, and shows a clear
  notice before a trainee is listed. A trainee can leave a leaderboard at any
  time.
- Instructors and the organization always see mastery needed to teach and
  assess, regardless of the public setting. The setting controls what other
  people see.

## Leaderboards

- Off by default. The organization admin switches one on for the organization.
- Public when on (for trainees who allow it).
- Ranked by mastery progress and consistency. Speed and raw XP are not ranking
  inputs.

## Instructor view

- Per trainee: mastery by objective, practice activity, formal results.
- Cohort: which objectives the class struggles with, objective-by-trainee
  matrix, questions that look ambiguous or too easy, pool coverage gaps.

## Mission map (after practice mode works)

Per course: modules are stages; a stage unlocks when the trainee reaches the
required mastery in the previous one. Mostly interface over data from the
earlier phases.

## Build order

1. **Foundation:** pool tag on approved questions, practice sessions and
   attempts stored server-side (answer keys never sent to the browser),
   mastery per objective, formal assessment with mastery gates and critical
   objectives, instructor settings per module.
2. **Game layer:** XP and reward rules, streaks, achievements, privacy
   setting, organization leaderboard.
3. **Mission map and unlock rules.**
4. **Scenario questions** (Application and Reasoning).
5. **Spaced repetition** (Retention).
6. Later: practical labs (needs a code sandbox), escape rooms, teams.

## Still to settle

- Exact mastery thresholds (how many correct, over how many sessions).
- XP amounts and daily caps.
- Wording of the leaderboard notice shown to trainees.
- Minimum questions per objective in each pool before a module can go live.
- Whether practice results are visible to the organization when a trainee
  chooses "only me" (proposed: instructors see mastery, not individual
  practice answers).

# AAICBI Knowledge Quest — design (draft 4)

Status: step 1 is built (see "What step 1 contains" at the end); the rest is design only. All numbers below are
starting values, to be tuned with real trainee data. This is the shared
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
| 10 | Mastery rule | 6 different questions correct, 80% over the last 10 answers, across 2+ separate days |
| 11 | XP amounts and caps | See the XP table: once per question per day, 100 XP daily cap |
| 12 | Minimum questions to go live | Practice 10, formal 6 per objective (approved only) |
| 13 | Organization sees individual practice answers | No, unless the trainee chose "my instructors and organization" |
| 14 | Leaderboard notice | Opt-in, wording below |
| 15 | Data approach | Store raw answer records and an XP ledger; compute mastery from them |
| 16 | Tunable numbers | Live in one settings place (platform defaults, module/course overrides) |
| 17 | Minimum answer time | Larger of 3 seconds or question words / 4 seconds |
| 18 | Pilot | One AI Automation cohort, about 4 weeks, with a staff tuning view |

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
a formal question. Minimum **approved** questions per objective before a module can be published
to trainees: **practice 10, formal 6** (each formal attempt draws 3 per
objective, so a retake mostly shows different questions). The instructor view
shows which objectives are short.

## Mastery (separate from XP)

- Tracked per learning objective from verified answers.
- Phase 1 measures **Knowledge**. Application and Reasoning arrive with
  scenario and written questions (later phase); Retention arrives with spaced
  repetition.
- An objective is **mastered** when all three hold:
  - at least **6 different questions** answered correctly;
  - accuracy of at least **80%** over the last **10 answers**;
  - those answers span at least **2 separate days**.
- Mastery fades to **needs refresh** if the objective has not been practised
  for **30 days**, or accuracy over the last 10 answers drops below **60%**.
- "Needs refresh" is **soft**: it changes only what the trainee sees in
  practice. It never affects the formal assessment or certificates.
- The refresh window is a **per-course setting** (default 30 days), so a short
  course and a long course can differ.
- The optional "practice before formal" check runs **once, when the formal
  assessment unlocks**, and is not re-checked afterwards.
- An answer given faster than the minimum time (below) counts against accuracy
  if wrong, but a too-fast correct answer is **not evidence of mastery**.
- States the trainee sees: Not started, Learning, Nearly there, Mastered
  (plus Needs refresh).
- Drives: gates, "what to revise next", and the instructor view.

## XP and rewards (instructor chooses what is on, per module)

| Action | XP |
| --- | --- |
| Correct answer, no hint | 10 |
| Correct answer with a hint | 5 |
| Correct on a retry after a wrong answer | 5 |
| Bonus for correctly answering a question missed before | +5, once per question |
| Practice day streak | +10 each day you continue a streak (from the second consecutive day) |
| Objective mastered | +50, once per objective |
| Module completed | +100, once per module |

Anti-farming:
- Each question earns XP **once per day**; answering it again that day earns 0.
- **Daily cap of 100 XP** from answers (about 10 questions). Mastery and
  completion bonuses sit outside the cap.
- Minimum answer time = the larger of 3 seconds or the question's word count
  divided by 4, in seconds (a 40-word scenario needs 10 seconds). A faster
  answer earns no XP and is not evidence of mastery. The trainee gets no
  warning or lockout; the answer simply earns no credit.
- When the daily cap is reached the trainee sees "Daily XP goal reached", not a
  penalty message. Mastery keeps progressing after the cap.
- XP is stored as a ledger of entries that never change. If rules change
  later, the new rules apply going forward and nobody loses earned XP.

Levels come from **mastery, not XP**. Explorer is the start; Problem Solver
needs about half of the course's objectives mastered. Practitioner and Mastery
Challenge need scenario and practical content (later phases). XP is the fun
counter and never decides a level or appears on a certificate.

## Privacy

- Per trainee: **only me**, **my instructors and organization**, or **public**.
  Default is **only me**.
- A leaderboard lists only trainees whose setting allows it, and shows a clear
  notice before a trainee is listed. A trainee can leave a leaderboard at any
  time.
- Always visible to instructors and the organization, whatever the setting:
  mastery by objective, days practised, number of questions answered, and all
  formal results.
- Visible only if the trainee chooses "my instructors and organization": which
  questions they got wrong and their individual practice answers.
- Class-wide patterns ("most people miss this question") stay available
  because they identify nobody.
- Sign-up and the privacy setting say plainly that mastery is shared with the
  course organization.

### Leaderboard notice (shown before a trainee is first listed)

> **Join the leaderboard?**
> [Organization name] has a public leaderboard. If you join, your name, photo,
> mastery progress and practice streak will be visible to anyone who views it.
> Your answers and scores are never shown. You can leave at any time in your
> privacy settings, and joining has no effect on your certificate.
> **[Join leaderboard]  [Not now]**

A trainee is never listed without tapping Join, and leaving removes them
straight away.

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

## Data approach and settings

- **Every practice answer is its own record**: question, correct or not, time
  taken, hint used, when. Mastery is calculated from these records, so
  changing a threshold (for example 6 questions to 5, or 30 days to 45)
  updates everyone correctly with no data migration.
- **XP is an append-only ledger** (see above).
- **All tunable numbers live in one settings place**: mastery thresholds,
  refresh window, XP amounts, daily cap, minimum answer time, pool minimums.
  Platform defaults, with module or course overrides where the instructor or
  organization is allowed to choose.

## Pilot and tuning

- Pilot with one AI Automation cohort for about 4 weeks.
- A small staff-only tuning view shows: how many learners hit the daily XP cap,
  how many answers were too fast, mastery over time, and how many mastered
  objectives fall back to "needs refresh" before the formal assessment.
- Reading the numbers:
  - more than about half of active days hit the XP cap: the cap is too low;
    almost none: too high, or too few questions;
  - many mastered objectives lapse before the formal assessment: the refresh
    window is too short for the course pace.
- Keep "practice before formal" off during the pilot (already the default).
- After the pilot, adjust the settings; no code change should be needed.

## Build order

1. **Foundation:** pool tag on approved questions, practice sessions and
   per-answer records stored server-side, an XP ledger, a settings place (answer keys never sent to the browser),
   mastery per objective, formal assessment with mastery gates and critical
   objectives, instructor settings per module.
2. **Game layer:** XP and reward rules, streaks, achievements, privacy
   setting, organization leaderboard.
3. **Staff tuning view**, before the pilot starts.
4. **Mission map and unlock rules.**
5. **Scenario questions** (Application and Reasoning).
6. **Spaced repetition** (Retention).
7. Later: practical labs (needs a code sandbox), escape rooms, teams.

## Still to tune with real data (after the pilot)

- The 30-day refresh window and the 100 XP daily cap (first guesses; low
  stakes because XP never decides levels, ranking or certificates).
- Level boundaries beyond Problem Solver, once scenario and practical content
  exists.

## What step 1 contains (built)

Data and rules
- `src/lib/quest/core.ts`: every number above, as pure tested functions
  (mastery, XP, minimum answer time, levels, pool coverage, auto-split, next
  question choice, formal draw, mastery gates). Tests in `tests/questCore.test.ts`.
- `src/lib/quest/server.ts`: access, practice sessions, answers, hints, XP
  ledger, formal unlock and gate helpers.
- Tables: `PracticeAnswer`, `XpEntry` (idempotent via `dedupeKey`),
  `ModuleQuestSettings`, `FormalUnlock`; `Question.bankPool`,
  `ModuleLearningObjective.isCritical`.

Trainee
- Practice screen `/trainee/courses/[id]/modules/[moduleId]/practice`:
  objectives with mastery and progress, question card with hint, feedback with
  explanation and lesson pointers, XP, streak, level, daily goal.
- Practice strip on the course page; "Practise first" notice and link on the
  assessment page; required objectives named on a result that was held back.

Instructor
- `/admin/modules/[id]/quest`: pool coverage per objective, per-question pool,
  automatic split, required objectives, go-live switch (refused until both
  pools meet the minimums), practice-before-formal with a percentage, and
  reward switches.

Formal assessment
- Draws only formal-pool questions (untagged legacy questions stay formal),
  guarantees up to 3 questions per required objective, and fails an attempt that
  clears the pass mark but misses a required objective.

Not in step 1 (on purpose)
- Trainee privacy setting and organization leaderboards (step 2).
- Staff tuning view (step 3), mission map (step 4), scenarios, spaced
  repetition, teams.
- XP is stored from day one but only the practice screen and the module strip
  show it; no public profile exposure yet.

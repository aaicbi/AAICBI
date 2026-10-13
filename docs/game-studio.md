# Game Studio

One page, `/admin/studio` (sidebar: Teaching, **Game Studio**, Super Admin only), where games are made,
written with Loop, previewed exactly as trainees will play them, and assigned to modules. It replaces
moving between the assessment page, the question bank and the Practice and mastery page.

## The page

- **Library (left):** the games you have made, and every course's modules. Pick a game and a module.
- **Build (middle):** the selected game (rename, choose its rewards, assign it to the selected module,
  switch it live), the module's items for that game's format (approve, delete, write one yourself), the
  module's quiz question pools (coverage, required objectives, automatic split) and the "practice first"
  gate for the formal assessment.
- **Preview (right, top):** plays the selected module's game the way a trainee would. Drafts are included and
  marked as drafts. Nothing is recorded and no XP is paid.
- **Loop (right, bottom):** the Command Center chat in a compact form. It knows which module and game are on
  screen. When it changes something, the page refreshes at once.
- On a phone or a narrow window the four panels become tabs.

## Games and formats

A game is built once and assigned to as many modules as you like. Each assignment is hidden or **live**.

| Format | Plays from | Needs before it can go live |
| --- | --- | --- |
| Quiz practice | the module's approved question bank (practice mode, mastery, hints) | every objective has 10 approved practice and 6 approved formal questions; only one live quiz game per module |
| Matching cards | `GameItem` rows (3 to 6 pairs) | at least one approved item |
| Put in order | `GameItem` rows (3 to 8 steps, stored in the correct order) | at least one approved item |
| Scenario choices | `GameItem` rows (situation, 2 to 4 options, one best, an outcome for each) | at least one approved item |

Making a quiz game live switches the module's practice on, and removing it switches it off (the existing
Knowledge Quest settings stay the source of truth for quiz practice). Modules whose practice was already on
before the studio got a quiz game assigned automatically by the migration.

## Content rules

- Items written by **Loop are drafts**. Trainees never see a draft. A person approves them, one at a time or
  "approve all", ideally after trying the preview.
- Items written by a person are approved straight away. Editing an item sends it back to draft.
- Loop's `approve_game_items` action is **always** shown for approval, whatever the chat's level. Loop cannot
  approve its own drafts.
- Every item belongs to one confirmed learning objective of its module.
- Server code validates every item (`src/lib/quest/games.ts`): counts, no empty parts, no duplicates, exactly one best scenario option.

## What trainees get

A **Games** strip on the module in the course page, and `/trainee/courses/[id]/modules/[moduleId]/games/[gameId]`.
Items are served shuffled with no answer key; the server grades. Matching and ordering score by share correct
(full marks needed for XP), scenarios by the best option. XP follows the same rules and ledger as practice
(10 XP, once per item per day, 100 XP daily cap, minimum answer time of the larger of 3 seconds or words / 4,
missed-before bonus, the game's reward switches). XP never counts toward certificates.

## Not built in this step

- Matching, ordering and scenario plays do **not** feed mastery yet (mastery still comes from quiz answers
  only). They pay XP and are recorded in `GamePlay`.
- Streaks do not count game plays yet.
- Per-question pool assignment for quizzes stays on the detailed Practice and mastery page (linked from the
  studio); coverage, the automatic split and required objectives are in the studio.
- Instructors and organization staff do not get the studio; they keep the Practice and mastery page.

## Loop in the studio

Actions added to the registry (`src/lib/loop/actions.ts`): `create_game`, `set_game_rewards`, `assign_game`
(risky only when it makes a game live), `add_game_items` (drafts), `approve_game_items` (always asks).
Read tools: `list_games`, `get_game_items`. The studio sends which module and game are selected with each
message, and the prompt tells Loop it is in the studio.

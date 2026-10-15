# Game Studio

One page, `/admin/studio` (sidebar: Teaching, **Game Studio**, Super Admin and organisation staff), where games are made,
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

## Mastery, streaks and pools

- A matching, ordering or scenario play counts toward mastery only for full marks. Each item is a different
  "question", so the same distinct-question, accuracy and days rules apply as for quiz answers. Half-right
  plays pay XP but do not count.
- Game plays count as practice days for the streak, and pay the streak bonus and the one-time
  objective-mastered and module-completed XP (same ledger keys, so nothing is paid twice).
- Per-question pool assignment for quizzes is in the studio (single question, or move all untagged ones).

## Question bank in the studio

The **Question bank** panel (Build column, beside the Loop chat) gets a module's questions ready without leaving the page. It has **two tabs that are kept apart**: **Games and practice** (10 needed per objective; used by quiz games and practice) and **Assessment** (6 needed per objective; used only in the formal assessment). Each tab has its own counts, review queue, approve button and list of approved questions, so a question written for one is never shown for the other.

Questions arrive only through **Import reviewed content** (below): they are written and reviewed outside the platform, so the bank has no write or review buttons and never calls Anthropic. For each tab:

1. **Approve.** Questions that passed wait for you: **Approve all that passed** makes that tab's questions live (it never touches the other tab). Flagged questions show their reasons, and each can be approved anyway, edited (an edited question waits for your approval again) or rejected. A flagged question is never approved in bulk.
2. **Move across.** Older questions that have no purpose yet are called out with **All for games and practice** / **All for the assessment**, and an approved question can be lent to the other side with **Also use for…**, which makes a separate, already-approved copy there.

Loop can read the bank (`get_bank_questions`) and approve what passed (`approve_bank_questions`, which always asks first). It does not write or review questions.

### Tidy objectives

The **Tidy up** panel (module page) repairs a module without any AI: **Merge into** moves one objective's questions, items, answers and plays into another and removes the emptied one; **Rename** changes an objective's wording (questions, items and history stay attached); **Remove** deletes an objective only if it is completely empty; **Fill the assessment side** moves spare practice questions to the Assessment side until each objective has 6 (keeping at least 10 for practice). Needs the question-pools permission. Code: `src/lib/quest/tidy.ts`, `/api/admin/studio/modules/[id]/tidy`.

Needs the **Question bank: write, review and approve** permission, used to import and approve (off by default for staff; a Super Admin always has it). Staff work only on their own modules. The older route still exists: a person presses **Approve for validation** on the Question bank page, then `run_bank_validation` checks the questions and a clean pass goes live by itself. Under the new route a clean pass waits for a person's approval instead.

## Tool permissions

A Super Admin chooses, per person, which tools they may use (studio page, "Your team: Loop level and permissions"). The same list limits what Loop will offer and run for that person, and the server refuses the matching actions even if a request is crafted by hand.

| Permission | Covers |
|---|---|
| Use Loop | Chatting with Loop at all |
| Make and edit games | Create, rename, delete, rewards |
| Write and approve items | Add, edit, delete items; approve Loop's drafts |
| Assign games to modules | Assign, switch live or off |
| Question pools and practice settings | Pools, practice rules, objectives |
| Question bank: write, review and approve | Write practice and exam questions for their own modules, have the reviewer model check them, and approve them (uses AI credits) |
| Platform analytics and overview *(all organisations)* | Platform numbers and module statistics |
| Cohort reports *(all organisations)* | List cohorts, read reports |
| People and reports *(all organisations)* | Search people; trainee, employer and staff reports |
| Messaging through Loop *(all organisations)* | Find recipients, read a trainee's chat, send, pause messaging |

Someone nobody has configured gets the first five (the studio set). The tools marked *all organisations* are not limited to the person's own modules, so they are always opt-in. Loop's own module and game reading tools stay limited to what the person owns or was invited to edit. `log_change_request` and the Super Admin's other tools can never be granted.

## Who can use it

- Super Admin sees everything and can set, per person, the highest Loop level they may use (`/people`).
- Organisation staff (admin, instructor) see only their own courses and the games they made. Other
  people's modules, games and items return "not found".
- Staff Loop gets the studio tools only (no platform data, no messaging), a limited prompt, and starts at
  level 1 until a Super Admin raises it. Approving drafts always asks, at any level.

## Loop in the studio

Actions added to the registry (`src/lib/loop/actions.ts`): `create_game`, `set_game_rewards`, `assign_game`
(risky only when it makes a game live), `approve_game_items` (always asks).
Read tools: `list_games`, `get_game_items`. The studio sends which module and game are selected with each
message, and the prompt tells Loop it is in the studio.

## Importing reviewed content

The module-content skill (`.claude/skills/module-content`) turns a module's lesson files into a reviewed content file (`content/<course>/<module>.json`): per learning objective, quiz questions, matching sets, ordering sequences and scenarios. In the studio, open the module and use **Import reviewed content**:

1. Choose the `.json` file. The panel checks every item against the platform's own rules and shows what would be saved: how many of each format are new, how many the module already has. It never calls Anthropic: the content was reviewed before it was written to the file. For each part of the file there is a **Goes to** menu: it starts on the module objective whose words match (same or similar wording), or "Add it as a new objective", and you can change it to any objective the module already has, or leave that part out. If content was already saved onto duplicate or empty objectives, use **Tidy up** to merge them. Choose these before importing so the content lands on your existing objectives instead of adding duplicates.
   Below the objectives, **Set aside N quiz questions per objective for the assessment** (default 6) puts that many of each objective's imported quiz questions on the Assessment side instead of Games and practice (spread through the set, taken out rather than copied). The quiz game needs at least 10 practice and 6 assessment questions per objective before it can go live, so with 20 per objective the default leaves 14 and 6.
2. Click **Import**. Missing objectives are added (confirmed by you). Quiz questions are saved as "passed review" on the **Games and practice** side of the question bank, and matching, ordering and scenario items are saved as drafts marked "Imported, reviewed outside". Optionally the four games are created and attached to the module, switched off.
3. Nothing is playable until a person approves: use **Approve all that passed** on both the Games and practice tab and the Assessment tab of the question bank, and **Approve** on the drafts, then switch the games on.

Importing the same file again adds nothing (items the module already has are skipped, and games are not created twice). Needs the question-bank and item permissions (and the games one to create games). Code: `src/lib/quest/contentImport.ts` (checking and planning, pure), `contentImportApply.ts` (database), `/api/admin/studio/modules/[id]/import`, `src/components/studio/ImportPanel.tsx`. Tests: `tests/contentImport.test.ts` and `scripts/device-checks/content-import.cjs`.

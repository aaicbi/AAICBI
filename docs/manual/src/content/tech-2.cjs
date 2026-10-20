// Technology guide, chapters 4 and 5: security and identity, the Game Studio.
module.exports = (L) => {
  const { chapter, p, bullets, table, tip, warn, note, h3, h4, why, pair, shot } = L;

  const ch4 = chapter('x4', 4, 'Identity, security and the permission engine',
    'How people sign in, how the platform decides what each person may do, and the safeguards around every request.',
    h3('Sessions: signed tokens in a protected cookie') +
    p('After sign-in the platform issues a signed token (HS256, library `jose`) in a cookie that is `httpOnly`, `SameSite=lax` and `secure` in production. The signing secret must be at least 32 characters and not the example value, or the app refuses to start. Session length depends on the role and can be changed by an administrator: staff 12 hours, trainees 7 days, employers and investors 24 hours. If those settings cannot be read, built-in values are used so a database hiccup never locks anyone out.') +
    why('written', '`session.ts`: forcing a trainee on a multi-week course to sign in every 12 hours is “real friction with no corresponding security benefit”; a 24-hour employer session is “long enough to not be annoying … short enough to matter for an account holding real applicant contact information”. Cookie lifetime and token expiry now come from one number because an earlier hand-kept second value would have signed a new role out early.') +
    why('inferred', '`jose` runs in the edge middleware runtime (where the common `jsonwebtoken` package does not), so the same library verifies the session in middleware and on the server.') +
    p('`getSession()` re-checks the account on every request: a suspended staff member or a removed organisation teammate is signed out on their next click, not when the token would have expired.') +
    h3('Passwords and sign-in routes') +
    p('Passwords are hashed with `bcryptjs` (cost 10). Each account type has its own sign-in and reset routes (trainee, staff, employer, investor, training organisation). Trainees may also use Google sign-in. Training organisations, owners and teammates alike, can reset or change their password themselves. Reset links last one hour and work once.') +
    why('inferred', 'bcryptjs is pure JavaScript, so it needs no native build step on a serverless host. Its cost factor of 10 is a common default; no written rationale was found for the number.') +
    h3('Middleware: a fast first check, never the only check') +
    p('The middleware verifies that a valid session cookie exists and redirects signed-out visitors to the right sign-in page, remembering where they were going. It deliberately does not decide roles: every endpoint and page still calls the permission check itself. Middleware also hides the internal staff sign-in page behind a configurable address and marks staff areas `noindex`.') +
    why('written', '`middleware.ts`: middleware only answers “is there a valid session”; “API routes still call requireRole(...) themselves as the real enforcement point”. `staffAccessPath.js`: “Hiding the address is not the protection: every staff page and API still checks the session and role on the server.”') +
    h3('The permission engine (RBAC)') +
    p('Before this engine, access was decided in several places at once: the role, a navigation table, per-person studio keys, a reviewer flag, the organisation team role and about 398 separate role checks. The engine replaces that with one resolver.') +
    table(['Part', 'What it does'], [
      ['Catalogue (`rbac/catalogue.ts`)', 'Every permission is named `category.feature:action` — for example `gaming_studio.games:publish` or `gaming_ops.results:export`. Actions are view, create, edit, delete, manage, approve, publish, moderate, export, configure and assign_permissions. About 90 features across 14 staff categories plus an organisation-only category. A subset is marked high risk.'],
      ['Role templates (`templates.ts`)', 'Eight ready-made roles as data, for example Gaming Studio Administrator, Gaming Operations Moderator, Platform Administrator, Reports Officer. Custom roles can be saved.'],
      ['Resolver (`resolve.ts`, pure)', 'Super Admin: all staff permissions and cannot be locked out. Inactive or non-staff: nothing. Staff with no role set: exactly the legacy access they already had. Otherwise: template or custom role, plus personal grants, minus personal denials, then gates (no Studio permission counts without Studio access).'],
      ['Guard (`guard.ts`)', 'Built on the older role check so sign-in, team status and billing pauses still apply first; reads the database each request; takes the organisation from the session; answers “not found” and records an audit event for cross-organisation attempts.'],
      ['Anti-escalation (`authority.ts`)', 'Nobody edits their own permissions; Super Admin accounts cannot be edited in the app; a non-super manager needs the assign-permissions permission, may only hand out keys they hold themselves, and can never hand out high-risk keys.'],
      ['Audit (`audit.ts`)', 'One `AuditEvent` table: actor, role, action, resource, organisation, outcome (OK, DENIED, FAILED), reason and before/after values. Writing is best effort and never records passwords, tokens or message text.'],
    ]) +
    why('written', '`docs/rbac-audit-and-plan.md`: role ADMIN meant two different things (an AAICBI admin and a training organisation signed in as an admin), and “this is how organizations reached the Game Studio”. Existing access is preserved by legacy defaults so “nobody gains or loses access on deploy”; the migration is additive; and 398 existing checks “cannot be rewritten safely in one change”, so categories move over one at a time.') +
    p('Training organisations have their own small permission set, `org_games.*`, resolved from their team role (Owner and Manager may moderate; Editor and Viewer may only view) and from a per-organisation policy that the Super Admin controls with nine switches. Organisation team roles are enforced on every request: Owner everything; Manager everything except billing; Editor builds content but cannot publish, delete, change the public profile, billing or team; Viewer reads only.') +
    pair('tech/staff', {}, {}, 'The staff page, where a Super Admin gives each staff member a role template or individual permissions.') +
    h3('Rate limiting, request safety and validation') +
    table(['Safeguard', 'How it works', 'Why it is built this way'], [
      ['Rate limiter (`rateLimit.ts`)', 'Fixed-window counters in a Postgres table, about 79 call sites. Examples: sign-in 5 per 15 minutes, registration 10 per hour, AI chat 30–40 per 15 minutes.', 'Written: an in-memory limiter on serverless “could be far weaker than it looks”; Postgres is already there. The small race between read and write is openly acknowledged.'],
      ['SSRF guard (`ssrfGuard.ts`)', 'Before the server fetches a staff-provided web address, it resolves the name and refuses private, loopback, link-local and cloud-metadata addresses; it fails closed.', 'Written (M40 audit): checking only the protocol is not enough. The disclosed limit: it does not defend against DNS rebinding.'],
      ['Validation (zod)', 'About 282 files validate input with zod; AI replies are validated too.', 'One declared shape per endpoint keeps invalid data out of the database.'],
      ['`withApiErrors`', 'A wrapper used by 439 route files that turns errors into clean JSON (409 for blocked deletions, 404 for stale sessions, logs only real failures).', 'Written: keeps route files free of repeated try/catch code.'],
      ['Webhook and cron secrets', 'The Paystack webhook checks an HMAC-SHA-512 signature on the raw body; cron endpoints require a bearer secret and give an identical 401 whether the secret is missing or wrong.', 'Written: do not help an attacker work out which part failed.'],
      ['Cookie consent', 'No visitor-tracking cookie or event is created until a visitor accepts.', 'Written in `CookieConsentBanner.tsx`.'],
    ]) +
    warn('What the code does **not** contain: no Content-Security-Policy, HSTS or X-Frame-Options headers are set by the application, and there is no CSRF token mechanism. Protection relies on the `SameSite=lax` httpOnly cookie, JSON-only endpoints and server-side role checks, and HTTPS is provided by the host. No document explains these choices. They are listed again in the final chapter as items to review.'));

  const ch5 = chapter('x5', 5, 'The Game Studio',
    'The tool where learning games are built, reviewed, tested and switched on, and the engine that serves and grades them.',
    h3('What the Game Studio is') +
    p('The Game Studio is one page, `/admin/studio`, where games are made, played exactly as trainees will play them, and assigned to course modules. It replaces moving between the assessment page, the question bank and the practice settings. It has four panels: **Library** (games and every course’s modules), **Build** (the selected game’s items, quiz pools, practice rules, question bank, tidy tools and import), **Preview** (plays the module’s game as a trainee would, with drafts marked and nothing recorded) and **Loop** (a compact AI assistant that knows which module and game are selected). Below a wide screen the four panels become tabs.') +
    pair('tech/studio', {}, {}, 'The Game Studio. Only the Super Admin and staff who were granted Studio access can open it; training organisations never can.') +
    h3('Who can use it') +
    p('Studio access is a permission, `gaming_studio.access:view`, and each action then needs its own permission: create, edit, delete, publish, manage (attach to a module), preview, manage assets, configure settings, configure the engine, manage Loop, manage the question bank and approve bank questions. Viewing results and moderating games belongs to a different family, `gaming_ops.*`, and **never opens the Studio**. Training organisations get a separate, limited Games section for their own courses.') +
    why('written', '`docs/rbac-audit-and-plan.md`: the Studio was reachable by organisations only because role ADMIN meant two things; the fix is separate permission families so building games and watching games are different jobs. `rbac/legacy.ts`: “nobody but a Super Admin has any gaming_studio.* permission until it is granted.”') +
    h3('The four game formats') +
    table(['Format', 'What the learner does', 'Rules enforced when it is saved'], [
      ['Quiz', 'Picks the correct option; questions come from the module’s approved practice pool with hints, XP and mastery tracking.', 'Bank rules: exactly one correct answer, at least two options, objective-tagged, human-approved.'],
      ['Matching', 'Pairs terms with meanings.', '3 to 6 pairs; lefts unique and rights unique (ignoring case); text up to 300 characters.'],
      ['Ordering', 'Puts steps in the right order by dragging.', '3 to 8 unique steps stored in the correct order.'],
      ['Scenario', 'Chooses the best action in a realistic situation and sees the outcome of each option.', '2 to 4 options, exactly one best, each with text and an outcome.'],
    ]) +
    p('A game is built once and can be assigned to many modules. Going live is gated: a quiz game needs every learning objective to have enough approved questions (10 for practice and 6 for the formal assessment) and only one quiz game can be live per module; item games need at least one approved item. Deleting the last approved item pauses live games automatically.') +
    why('written', '`quest/studio.ts` and `docs/game-studio.md`: the existing Knowledge Quest settings stay “the source of truth” for quiz practice, so switching a quiz game live or off simply drives the existing practice setting.') +
    h3('From idea to live game: the lifecycle') +
    table(['Stage', 'What happens', 'Who or what is the gate'], [
      ['1. Content arrives', 'Reviewed content is imported from a file (see below), or a person writes items by hand.', 'Import never calls AI and never publishes.'],
      ['2. Draft', 'Imported items become drafts; imported quiz questions are marked “passed review” but still wait for approval. Trainees never see drafts.', 'Automatic.'],
      ['3. Review and edit', 'A person edits an item; editing returns an approved item to draft because “edited content must be looked at again”.', 'Human.'],
      ['4. Approve', 'Approve items and bank questions one by one or in bulk. A flagged item can never be bulk-approved.', 'Permission `bank:approve`; Loop’s approval action is always shown for confirmation.'],
      ['5. Preview', 'Play the game as a trainee would, including drafts, without recording anything. Graded by the same grading function.', '`testing:view`.'],
      ['6. Go live', 'Attach to a module and switch on; optionally “show on the feed” for signed-in visitors.', '`games:manage`; `games:publish` only when the live state actually changes; logged as an audit event.'],
    ]) +
    h3('The Question Bank inside the Studio') +
    p('The bank keeps two sides apart: **Games and practice** (10 questions per learning objective) and **Assessment** (6 per objective), so formal-exam questions are never shown in practice. Questions pass through states: awaiting review, ready, flagged, approved, rejected. Studio actions are approve, assign to a side, copy to the other side, reject and edit. Every change writes a `QuestionBankEvent` so there is a history of who did what.') +
    h3('Importing reviewed content, and tidy tools') +
    bullets([
      '**Import** takes a file shaped as `{course, module, objectives:[{quiz, matching, ordering, scenario}]}` (up to 20 objectives and 40 items per format). It always previews first; each objective in the file is matched to an existing one by word similarity, or marked new or skipped. It reserves a share of quiz questions (default 6 per objective) for the assessment side, creates the four games switched **off**, and is repeatable: a signature check means importing the same file twice adds nothing.',
      '**Tidy tools** merge duplicate objectives, rename them (409 if the wording already exists), delete empty ones, and move spare practice questions to the assessment side until 6 per objective remain. None of these use AI.',
    ]) +
    why('written', '`quest/contentImport.ts` and `docs/game-studio.md`: nothing becomes playable until a person approves both bank tabs, approves drafts and switches games on; the importer “never calls Anthropic”.') +
    h3('How the content is written: the module-content workflow') +
    p('Game and practice content is produced by a documented workflow (`.claude/skills/module-content`). Lesson files are turned into learning objectives, which a person confirms. Writer agents (Claude Sonnet) then write 20 quiz questions, 20 scenarios and 10 to 20 matching and ordering items per objective, using only the lesson text. Reviewer agents (Claude Opus, a **different** model) answer every item blind — they never see the intended answer — and flag anything unsupported, ambiguous, off-objective, duplicated, a giveaway, unclear or factually wrong. Writers fix the flags, and the cycle repeats up to three times. Disputes about a quiz or scenario answer go to a separate Opus tie-break rather than back to the writer.') +
    table(['Result from the first module (recorded in the workflow notes)', 'Value'], [
      ['Items flagged after review pass 1, 2, 3', '261 of 640, then 125, then 59'],
      ['Disputed answers sent to tie-break', '35, and the writer’s key was right in all 35'],
      ['Commonest defect', 'The “giveaway”: the correct option is longer than the others'],
      ['Hardest format', 'Ordering — when the source does not fix a sequence, delete rather than rewrite'],
    ]) +
    why('written', '`bankModels.ts`: “One model WRITES the questions and a DIFFERENT model REVIEWS them, so a question is never checked by the model that wrote it (the same model tends to repeat its own mistakes).” The workflow notes add: “Never trust a lone disagreement: tie-break first.”') +
    h3('Loop inside the Studio: an assistant that proposes, never decides') +
    p('Loop is the platform’s Claude-powered assistant, shown in compact form in the Studio. Claude never writes to the database itself: it names an action, the server validates it with a schema and writes a plain-words summary, and the chat’s autonomy level decides whether it runs now or shows an approval card. Every proposed or executed action is stored with its exact input, and approving runs exactly that recorded input.') +
    table(['Autonomy level', 'Behaviour'], [
      ['1. Ask first (default)', 'Every action shows an approval card.'],
      ['2. Balanced', 'Low-risk actions run; high-risk actions ask.'],
      ['3. Autonomous', 'Actions run, except those marked always-confirm.'],
    ]) +
    bullets([
      'Always-confirm actions include approving game items and approving bank questions, so Loop can never approve its own drafts. Messages to more than 25 people always ask first.',
      'Studio actions are `create_game`, `set_game_rewards`, `assign_game` (high risk only when it makes a game live), `approve_game_items` and `approve_bank_questions`.',
      'Permissions are enforced inside the tool loop, so a request for something outside the person’s permissions fails even if the prompt never offered the tool. Staff without full access get a limited prompt that lists only what they were granted and start at level 1 unless a Super Admin raised their level.',
      'The model is `claude-sonnet-4-5` by default (override `LOOP_MODEL`); replies stream; up to 12 tool rounds per message.',
    ]) +
    why('written', '`docs/loop-command-center.md`: “Claude never writes anything itself. It names an action; the server validates it, writes a plain-words summary, and the chat’s level decides whether it runs now or shows an approval card.” “Loop can do exactly what its tools and actions allow, no more.” “Approving runs exactly the recorded input.”') +
    why('inferred', 'Forcing the model through validated actions limits the damage of a mistaken or manipulated answer to a proposal a person can read, which is the safest place to put an AI in a workflow that affects learners.') +
    h3('The engine: serving and grading, with cheating in mind') +
    p('Every number of the learning design lives in one pure file, `quest/core.ts`, which has its own tests. The database half (`server.ts`, `studio.ts`) serves and records.') +
    table(['Rule', 'How it works', 'What it prevents'], [
      ['Answer key stays on the server', 'Matching serves the left items in order and the right items shuffled with no mapping; ordering serves shuffled steps (re-shuffled up to 5 times so they are never served already in order); scenarios serve option texts without the “correct” flag or outcome. The key and outcomes return only after the answer.', 'Reading the answers from the page or network.'],
      ['One question at a time', 'The browser asks for each item separately; there is no batch download.', 'Pulling every question in advance.'],
      ['Server clock', 'The play row is created when the item is served; time taken is now minus that time. A resumed item is re-served, not re-rolled, for 10 minutes.', 'Claiming a fake answer time.'],
      ['Double-submit guard', 'An answer is claimed with a conditional update (only if not yet answered).', 'Double XP from a double tap.'],
      ['Too-fast flag', 'Minimum seconds = the larger of 3 or the word count divided by 4, rounded up. A faster correct answer earns no XP and is not mastery evidence; a faster wrong answer still counts against accuracy.', 'Guessing at speed to farm XP or fake mastery. There is no warning or lock-out; the answer simply earns no credit.'],
      ['Tamper checks', 'Ordering must be the same length, unique and made of the real steps; matching must be complete; a scenario choice must equal an option.', 'Crafted submissions.'],
      ['Partial credit', 'Matching and ordering score the share of pairs or positions right; scenarios score 1 or 0. Only full marks count toward mastery.', 'Rewarding half-knowledge as mastery while still paying small XP.'],
    ]) +
    h4('Mastery, XP and the practice design') +
    table(['Rule', 'Value'], [
      ['Mastery of an objective', 'At least 6 different questions correct, accuracy of at least 80% over the last 10 answers, and evidence on at least 2 separate days.'],
      ['Mastery stays', 'Until 30 days of inactivity or window accuracy falls below 60%, then “needs refresh”.'],
      ['XP', 'Correct 10; with a hint 5; correct on a same-day retry 5; bonus +5 once for a question missed on an earlier day; streak day +10; objective mastered +50; module completed +100; daily cap of 100 for answer XP.'],
      ['XP ledger', 'Append-only with a unique key per award, so races and rule changes never take earned XP away. XP never counts toward certificates.'],
      ['Day boundary', 'Nigerian time (UTC+1, no daylight saving) so a “day” matches the learners’ day.'],
      ['Question choice', 'Weakest objective first; within it never seen, then last wrong, then least recently answered; never the previous question again.'],
      ['Rounds', 'Rounds of 10, requested one question at a time.'],
      ['Formal exam link', 'Critical objectives must be cleared as well as the pass mark; the exam draw guarantees questions for each critical objective.'],
    ]) +
    why('written', '`docs/knowledge-quest-design.md`: “A trainee progresses because they show competence, not because they spend time or collect points.” Formal result, mastery and XP are kept apart. Practice answers are stored raw, so thresholds can change “with no data migration”. The numbers are “starting values, to be tuned with real trainee data”.') +
    why('none', 'The specific numbers (80%, 6, 10, 2 days) have no written justification beyond “first guesses; low stakes”.') +
    why('inferred', 'Requiring different questions on separate days makes it hard to pass by memorising one question or cramming in one sitting.') +
    h3('The front end of a game') +
    table(['Technique', 'What it is', 'Why it fits'], [
      ['CSS-only animation', 'All game motion uses CSS keyframes on transform and opacity (the `gx-` classes). A small confetti is drawn from page elements that remove themselves. No animation library is installed. A global reduced-motion rule switches it all off.', 'Written: “No animation libraries were added.” Inference: transform and opacity animations stay on the graphics processor, which matters on low-end Android phones.'],
      ['Web Audio synthesis', 'Sounds are tones made in the browser (select, correct, wrong, streak, completion) — no audio files. Sound is off by default; the preference is remembered; audio starts only after a tap, as browsers require; a miss sounds “soft and falling, never a buzzer”.', 'Written: “no audio files to download, license or lose”.'],
      ['Drag-and-drop ordering', 'Pointer Events with pointer capture; only the handle drags so scrolling still works on touch; the row follows the pointer; the page scrolls near an edge; the Up/Down arrow keys work on the handle.', 'One implementation shared by practice and the arena; keyboard users are not locked out.'],
      ['Accessible by design', 'Everything works by keyboard; feedback and the countdown are announced politely; progress pips carry text, not only colour.', 'Written in `docs/game-experience.md`.'],
    ]) +
    pair('tech/studio-demo', {}, {}, 'The sample-games page: ten sample items per format, graded by the same functions the server uses, nothing saved.') +
    h3('Settings and results') +
    p('Global arena switches and rules live at `/admin/arena` and need `gaming_studio.settings:configure`. Results live in a separate page that merges course games, quiz practice and games opened from the feed; viewing needs `gaming_ops.results:view` and download needs export permission and is audited.') +
    pair('tech/game-results', {}, {}, 'Game results: every player with answers, accuracy and latest answers, kept separate from the Studio.') +
    h3('Why this design is a strong fit for AAICBI') +
    bullets([
      '**Teachers stay in charge.** AI helps produce and review content, but a person approves every question and item, and the assistant cannot approve its own work.',
      '**Fair for learners.** The answer key never leaves the server, timing is server-side, and mastery is based on different questions on different days rather than points.',
      '**Low operating cost.** Imports, tidy tools and the bank call no AI at run time. Content is produced once, reviewed, and reused by every learner.',
      '**Works on modest phones.** One question at a time, CSS animation, synthesised sound and no large libraries keep games light.',
      '**Safe to change.** Every threshold is in one tested file, and stored raw answers mean a rule change never needs a data migration.',
    ]));

  return [ch4, ch5];
};

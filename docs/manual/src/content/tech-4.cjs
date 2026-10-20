// Technology guide, chapters 8 to 10: learning engines, the AI layer, and the supporting engines (search, social, messaging, money, speed).
module.exports = (L) => {
  const { chapter, p, bullets, table, tip, warn, note, h3, h4, why, pair, shot } = L;

  const ch8 = chapter('x8', 8, 'The learning engines',
    'Exams, assignments, course progress, early warning and analytics. Each one is a small set of rules that can be tested on their own.',
    h3('The exam engine') +
    p('An examination is a timed, graded set of questions. The engine lives in `examEngine.ts` (the part that talks to the database) and `examEngineCore.ts` (the part that only does arithmetic and ordering). Three rules are written at the top of the file because they are easy to break in a hurry:') +
    bullets([
      '**The answer key never reaches the browser during an attempt.** One function, `serveableQuestion()`, is the only code allowed to shape a question for the client before submission. It leaves out `isCorrect` and `explanation`.',
      '**The timer is cosmetic on the phone.** `expiresAt` is calculated once, on the server, when the attempt starts, and every later write is checked against it. Changing the device clock does not add time.',
      '**Grading happens once, atomically.** Submitting an attempt that is already submitted returns the existing result and does not grade again.',
      '**Starting is idempotent.** A double tap on “Start” or a reload of the instructions page does not burn a second attempt; the unique key on exam, trainee and attempt number catches the race, and the engine returns the attempt already in progress. The maximum number of attempts is enforced here.',
      '**The question order is saved** with the attempt, so a reload shows the same order. `reconstructOrderedItems` rebuilds it from the saved list.',
    ]) +
    why('written', '`examEngine.ts` header: “never send `isCorrect` or `explanation` to the browser for a question in an IN_PROGRESS attempt … the timer is cosmetic on the client … grading happens once, atomically, on submit.” A comment records the “M11 audit finding” that led to the double-tap protection.') +
    why('inferred', 'Postgres transactions and unique constraints are the right tool for “exactly once” because they work the same on one server or fifty serverless instances, which a lock held in memory would not.') +
    h3('Performance analysis after an assessment') +
    p('When a trainee submits, `performanceCore.ts` groups the answers by topic and counts right and wrong, with no AI at all. Questions without a topic go in a “General” bucket rather than being dropped, so nothing is left uncounted. Only then does a small AI call (`analyzePerformance.ts`) turn those numbers into a short narrative. The AI sees only the numbers, so it has nothing to make up.') +
    why('written', '`analyzePerformance.ts`: an audit found it had been using the larger model; “claude-haiku-4-5 is the deliberate choice now — cheaper, faster” because it runs on every submission and does a simple job.') +
    h3('The assignment engine') +
    p('Assignments take written answers. When a trainee submits, the submission is first marked SUBMITTED atomically; then `assignmentGrading.ts` decides what happens next. If AI assessment is on for the assignment, each answer goes to Claude **one at a time** (for predictable rate-limit behaviour) with the question, the rubric, the expected concepts and the answer. If it is off, no AI call happens at all: the whole submission is rendered as a PDF and emailed to the instructor for marking.') +
    bullets([
      '**Meaning, not wording.** The prompt tells the assessor to judge whether the student shows understanding, not whether the words match.',
      '**Structured, validated reply.** The model must return JSON with a score, maximum, per-criterion scores and reasons, strengths, areas to improve, feedback, a confidence and a `needs_instructor_review` flag. The reply is validated with zod; the score is clamped, because the code never trusts the model’s arithmetic.',
      '**The stronger model for the grade.** Grading uses `claude-sonnet-4-5` because the grade is relied on by the student and the instructor, so quality matters more than the cost per call.',
      '**Low confidence goes to a person.** A low-confidence answer is flagged for the instructor instead of being final.',
      '**Paste is blocked** in answer boxes, so answers are written by the trainee.',
      '**A resubmission path and a submission PDF** (`@react-pdf/renderer`) exist for instructors who mark by hand.',
    ]) +
    why('written', '`assessAssignmentAnswer.ts`: “claude-sonnet-4-5 deliberately, not haiku — this produces an actual grade a student and instructor both rely on, so quality matters more than per-call cost.” `assignmentGrading.ts`: “sequential, not parallel, for predictable rate-limit behavior.”') +
    note('Grading guidance cannot be trained. The “Train the AI” screen lists “Grading assignment answers” as deliberately not trainable, because guidance could bias marks (see chapter 9).') +
    h3('Courses, modules and progress locking') +
    p('A course is made of modules, a module of lessons and an assessment. `progressCore.ts` decides, from plain numbers, whether a module is complete and which modules are open. A module is complete when all its lessons are done and, if it has a **published** assessment, that is passed. The next module unlocks only when the one before is complete. `findNextModule` picks where “Continue” should land and `isCourseComplete` decides when a certificate may be issued. `progress.ts` fetches the numbers and calls the core.') +
    why('inferred', 'Keeping “what counts as complete” in one pure function means the trainee page, the organisation dashboard, the certificate engine and the early-warning rules all agree, and the rule can be tested with a table of cases instead of a browser.') +
    h3('Early warning for staff') +
    p('`earlyWarningCore.ts` raises two kinds of alert for a course: **inactivity** (a trainee who was active has not logged in for the course’s threshold of days) and **failed attempts** (too many failures). Two details show the care taken:') +
    bullets([
      'A trainee who has **never** logged in is not counted as inactive; that is a different problem (never started), and the code says so as “a conscious scope line”.',
      'An alert fires **again only when something has changed**: the trainee came back and went quiet again, or passed since the last alert. “Time passed” is not enough, so staff are not told the same thing every day.',
    ]) +
    why('written', '`earlyWarningCore.ts`: the INACTIVITY and FAILED_ATTEMPTS re-trigger rules are written out with their reasoning; “Not an oversight; a conscious scope line.”') +
    h3('Analytics, reports and the daily crons') +
    p('The analytics code (`src/lib/analytics`) aggregates visits, enrolments, completion and engagement into cohorts, streaks, segments and interest scores. Five scheduled jobs on Vercel keep the platform tidy; each is an ordinary API route protected by a secret:') +
    table(['Cron route', 'When (UTC)', 'What it does'], [
      ['`/api/cron/arena-sweep`', 'daily 05:00', 'Settles Arena invitations that ran out unanswered (and tells the sender). The app does this within seconds while people are online; the daily job is the backstop for a quiet day.'],
      ['`/api/cron/course-access-sweep`', 'daily 06:00', 'Handles lapsed course access and expiry reminders; the platform’s first scheduled job.'],
      ['`/api/cron/analytics-alerts`', 'daily 07:00', 'Checks the early-warning rules and writes staff alerts. Kept as its own job, separate from the access sweep.'],
      ['`/api/cron/analytics-report`', 'Mondays 08:00', 'Builds and sends the weekly analytics report as a PDF.'],
      ['`/api/cron/growth-messages`', 'every hour', 'Queues and sends follow-up messages that have come due for people who saved a taster score. Does nothing while messaging is off and sends nothing in quiet hours.'],
    ]) +
    why('inferred', 'Scheduled routes on the host’s own scheduler avoid running a separate worker server. The cost is that a job must finish within a serverless time limit, which is why each one does a bounded amount of work per run and is safe to run twice.') +
    pair('tech/command-center', {}, {}, 'The Command Center, where a Super Admin reads the platform’s reports and talks to Loop.'));

  const ch9 = chapter('x9', 9, 'The AI layer',
    'Claude is used in a dozen places. Each use has a model, a safeguard and a plain reason. This chapter lists them all.',
    h3('Why Claude, and why through one small client') +
    p('Every AI feature calls Anthropic’s Claude models through the official `@anthropic-ai/sdk`. The platform follows one house convention, written at the top of several AI files: **one file per feature, a system prompt that states the exact rules, a JSON reply validated with zod, fences stripped before parsing, and one retry before giving up.** If the key is missing or the call fails, the feature says so and the rest of the platform keeps working.') +
    why('inferred', 'Claude follows long, rule-heavy instructions closely and returns structured output reliably, which matters when the output decides a grade or a published question. Using one vendor, one SDK and one pattern keeps the security review small: there is one key, one billing account and one place to look.') +
    h3('Which model does what') +
    table(['Feature', 'Model', 'Why this model'], [
      ['Question extraction from uploaded documents (`extractQuestions`)', 'claude-sonnet-4-5', 'Reading messy documents and never inventing an answer needs the stronger model. Two attempts at most.'],
      ['Assignment question extraction', 'claude-sonnet-4-5', 'Same reasoning; the model is told explicitly not to guess a field it cannot find.'],
      ['Grading an assignment answer', 'claude-sonnet-4-5', 'A real grade; “quality matters more than per-call cost”.'],
      ['Performance summary after an assessment', 'claude-haiku-4-5', 'Runs on every submission and only rewords numbers: cheaper and faster.'],
      ['Learning patterns across assignments', 'claude-haiku-4-5', 'Same shape as the performance summary; fed only the numbers.'],
      ['Question bank writer', 'claude-sonnet-5-5 (default)', 'Drafts questions from lesson material. Configurable with `BANK_GENERATOR_MODEL`.'],
      ['Question bank reviewer', 'claude-opus-5-5 (default)', 'A different, stronger model re-derives every answer blind. Configurable with `BANK_REVIEWER_MODEL`.'],
      ['Guide consultant (advice on Loop’s knowledge)', 'claude-sonnet-4-5 (default)', 'Advice only; never writes an answer by itself. Configurable with `GUIDE_CONSULTANT_MODEL`.'],
      ['Job-posting screening', 'claude-sonnet-4-5', 'Looks for scams and discrimination before a posting goes live.'],
      ['Learning Buddy, Command Center, pitch feedback', 'Claude through the Loop engine', 'Conversation with tools; see below.'],
      ['Course examination generation, learning objectives', 'claude-sonnet-4-5', 'Drafts that a person must approve.'],
    ]) +
    why('written', '`bankModels.ts`: “One model WRITES the questions and a DIFFERENT model REVIEWS them, so a question is never checked by the model that wrote it (the same model tends to repeat its own mistakes).” The same file explains that setting both roles to the same model weakens the bank.') +
    note('Model names are read from the code on the publication date. Model versions change; the environment variables above let the Super Admin move to a newer model without a code change for the bank and the consultant. The other features have the model written in the file.') +
    h3('Safeguards that apply to every AI feature') +
    bullets([
      '**A person approves anything that is published.** Generated questions are drafts until reviewed; the consultant’s suggestions are cards a Super Admin approves through the normal form; Loop’s actions wait for approval according to the chat’s autonomy level.',
      '**The model only sees what it needs.** Performance feedback gets numbers, not the transcript. Assignment grading gets one question and one answer.',
      '**Never invent.** Extraction prompts forbid guessing an answer or a field.',
      '**Validated output.** zod schemas reject a reply that does not match; scores are clamped.',
      '**Timeouts.** Calls carry a timeout (30 s for grading, 60 s for the consultant) so a slow call cannot hang a page.',
      '**Graceful absence.** No key means the feature explains that it is unavailable.',
    ]) +
    h3('Training the AI, safely') +
    p('A Super Admin can approve a short guidance note for six features: the Command Center assistant, Learning Buddy, pitch feedback, assignment feedback summaries, performance summaries and question writing. The note is plain text, versioned, and added **after** the feature’s own rules so it can never replace or relax them. Three things are deliberately **not** trainable because they decide outcomes or protect people: grading assignment answers, checking the answer key of generated questions, and screening job postings.') +
    why('written', '`aiGuidanceCore.ts`: “It is added AFTER the feature’s own rules and can never replace or relax them”; the `NOT_TRAINABLE` list gives the reason for each exclusion (“Guidance could bias marks.”, “It must stay independent.”).') +
    h3('Loop and the Command Center') +
    p('Loop is the assistant character on every page. For trainees it is a learning buddy; for the Super Admin the Command Center is a full conversation engine (`loop/engine.ts`) that streams Claude’s answers and lets Claude read real platform data and documents through **tools**. Everything Claude can change goes through an **action registry** (`loop/actions.ts`); the chat’s autonomy level (`policy.ts`) decides whether an action runs now or waits for approval, and each run is recorded. The code states the principle: Claude’s own ability to discuss and plan is not narrowed; what it can **do** is exactly the tools and actions listed.') +
    why('written', '`loop/engine.ts` header: “Claude’s own capacity is not narrowed here … What it can DO is exactly the tools and actions below.”') +
    h3('The guide engine: answers without AI') +
    p('Before any AI is involved, Loop answers most questions from a curated knowledge base, matched by plain text rules (`guide/match.ts`, `intent.ts`, `similarity.ts`). It understands intents, offers “Take me there” and “Show me” buttons, respects the asker’s role, and can run a highlighted tour of the screen (`data-guide-target` marks). Unanswered questions go into a review queue ranked by priority; a Super Admin writes the answer once and everyone benefits. A test enforces that every page in the platform is registered in the site map.') +
    why('inferred', 'Answering common questions from approved text is free, instant, consistent and cannot hallucinate. The AI consultant is held back for the queue and for advice, which is where it adds value.') +
    h3('Monitoring and the consultant') +
    p('`monitorCore.ts` builds a snapshot of the platform (analytics, materials, assessments, performance) and applies deterministic signals. The consultant (`guide/consultant.ts`) turns the queue, the snapshot and module materials into suggestions, a platform report and proposals for AI-training notes. It runs only when a Super Admin presses a button **and** the switch is on, uses the platform’s existing Anthropic key, and its usage is audited.') +
    h3('Embeddings and duplicate detection') +
    p('Imported questions are compared by meaning so the bank does not fill with near-copies. Voyage’s `voyage-3-lite` produces a 512-number vector for each question; the vector is stored in Postgres using the `pgvector` extension (`vector(512)`), and `embeddingsCore.ts` applies cosine similarity with a duplicate threshold of **0.93**. The maths is in a zero-import file so it can be tested; the database lookup is separate.') +
    why('written', '`embeddingsCore.ts` explains that the pure maths is split from `embeddings.ts` so tests need no Prisma client or API key; `embeddings.ts` expects a dimension of 512.') +
    why('inferred', 'Storing vectors in the same Postgres avoids a second database to buy, secure and back up. A small, cheap embedding model is enough for “is this the same question reworded?”.') +
    pair('tech/platform-pictures', {}, {}, 'The Platform pictures screen, the maintenance tool that shrinks oversized pictures (chapter 10).'));

  const ch10 = chapter('x10', 10, 'Search, social, messaging, money and speed',
    'The supporting engines: finding things, posting safely, reaching people, taking payment and working on a poor connection.',
    h3('Search') +
    p('Global search covers people, organisations, employers, investors, startups, jobs and courses, with filters and suggestions. It uses Postgres itself: a search-indexes migration adds trigram (`pg_trgm`) and ordinary indexes for typo-tolerant matching and filters. Results respect visibility: a profile marked private does not appear.') +
    why('inferred', 'At this scale, search inside the existing database is faster to build, always consistent with the data and has nothing extra to run. A dedicated search server would add cost and a sync problem for little gain.') +
    h3('The social feed and automatic review') +
    p('Posts from members, showcase projects and organisation news share one `Post` model with one review pipeline. `posts/autoReview.ts` adds up warning signs in the words of a post (abuse, scam phrases and similar) and gives a score. Below the bar the post publishes at once and the decision is written to its history as “Auto-review”, so a person can still remove it later; at or above the bar it goes to the human review inbox with the reasons attached. **Nothing here ever rejects a post: only people reject.** The bar is **2** for ordinary members and **5** for trusted authors (a track record, nothing taken down, nothing open against them). Setting `POST_AUTO_REVIEW=off` sends everything except a Super Admin’s posts to a person.') +
    bullets([
      '**Reviewers are a permission**, not a role: staff with the review permission see a unified queue; serious cases escalate to the Super Admin; an organisation can be blocked from posting.',
      '**Public feed with an account gate:** anyone can read; interacting needs an account.',
      '**Handles:** every person has one address (`/@handle`). Old handles keep working after a change, and changes go through a request.',
      '**Showcase sync** mirrors a trainee’s project into the feed, through the same review.',
    ]) +
    why('written', '`autoReview.ts` header: “Nothing here ever rejects a post: only people reject … Trusted authors … are held to a higher bar.” The word lists are “short on purpose: they catch the obvious, and everything else is left to the reports and to the people who review.”') +
    note('The automatic reviewer is a word-and-pattern scorer, not an AI model. It will miss anything that does not use the listed words, which is why reports and human reviewers remain part of the design.') +
    h3('Notifications, email, push and WhatsApp') +
    table(['Channel', 'Tool', 'How it is used', 'Why it fits'], [
      ['In-app', 'Postgres rows', 'A notification list and unread count on every page.', 'Always available; no vendor.'],
      ['Email', 'Resend', 'Account, password, reminders, reports. Templates in `notifications/templates.ts`.', 'Simple API; sending only.'],
      ['Web push', '`web-push` with VAPID keys and the service worker', 'Opt-in per device. At most 10 subscriptions per account. Urgent messages stay on screen and vibrate.', 'Reaches a phone that has the browser closed, with no app store.'],
      ['WhatsApp', 'Meta WhatsApp Cloud API', 'Template messages only, because Meta only allows a business to start a chat with an approved template. Credentials and the switch are kept by the Super Admin on the Growth page; off until switched on.', 'WhatsApp is where many Nigerian learners already are.'],
    ]) +
    why('written', '`whatsapp.ts` states the template-only rule, that it is tested against a stand-in server that answers like Meta’s API, and that it “has NOT been run against Meta itself: that happens the first time real credentials are saved and ‘Test connection’ is pressed.”') +
    warn('WhatsApp delivery has not been proven against Meta’s live service. Treat it as built and simulated until the first real test message succeeds.') +
    h3('Messaging between people') +
    p('Trainees, organisations, employers and staff can message each other. A policy file decides who may start a conversation with whom, a moderation step checks messages, broadcast messages resolve their recipients from a filter, and a new message triggers a notification and, if allowed, a push.') +
    h3('Payments, billing and seat limits') +
    bullets([
      '**Paystack** takes card and bank payments. The webhook route is the only door for Paystack and authenticates by **signature**; the payload is redacted before it is stored; a confirmed charge is processed once by `processConfirmedCharge`; subscription events are matched to the right enrolment or organisation.',
      '**Organisation billing:** a DIRECT_PAYMENT organisation pays a platform fee and a certificate-watermark fee; a Super Admin can also confirm a payment by hand.',
      '**Seat cap:** `trainingOrgSeatCap.ts` counts every trainee with real, active access to any course of the organisation, however they got it. A free preview is a sample and never uses a seat.',
      '**Sponsored ads:** `adsCore.ts` defines what an ad may contain (headline 60, caption 140, button 24 characters), when it is live (Nigerian time, WAT), and how views and taps are counted; placements are the top of the feed, inline after every 6 posts, and the About page.',
      '**Growth ledger:** `growthCore.ts` keeps the public taster to five questions, 18 seconds each, and shows a percentile only after 30 people have finished so a small crowd never produces a made-up claim.',
    ]) +
    why('inferred', 'Paystack is the payment provider that supports Nigerian cards, transfers and subscriptions out of the box. Signature-first webhooks and “process once” are the standard way to avoid double-crediting.') +
    h3('Speed, low bandwidth and the installable app') +
    bullets([
      '**Progressive Web App.** A manifest, icons and a service worker (`public/sw.js`) make the site installable. It caches the shell and static files, never intercepts `/api/` calls, and shows an offline page. The install prompt appears only after a second visit and not within 30 days of “Not now”; iPhone gets Share instructions because Safari has no install button.',
      '**Lite connection mode.** `useLiteConnection` starts on, so the first paint never starts a large download, and turns off on a good connection. On 2G, 3G or data-saver, videos do not download by themselves.',
      '**Picture shrinking.** `sharp` shrinks oversized stored pictures to the width each kind is ever shown (480 px for avatars and logos, 1280 for course flyers, 1600 for covers). A new file is used only if it is at least 15% smaller, and small files are left alone.',
      '**Server-rendered pages** with Tailwind CSS keep the JavaScript sent to phones small; heavy libraries (the certificate editor, charts) load only on the pages that use them.',
      '**Phone-first layouts.** A role-aware bottom navigation, tables that turn into cards, 16 px inputs with proper keyboards, step-by-step long forms and a draggable Loop that never blocks a button.',
      '**Languages.** Interface strings can be translated; Yoruba, Igbo, Hausa and French are drafted with Google Translate and Nigerian Pidgin with Claude, because Google does not support Pidgin, and every draft is reviewed before it is trusted. English is the fallback.',
    ]) +
    why('written', '`useLiteConnection.ts`, `pictures/core.ts`, `pwa/installCore.ts` and `i18n.ts` each state their rule and reason in comments; the Pidgin-by-Claude choice is written in the schema comment for the translation model.') +
    h3('Landing, About and public pages') +
    p('The home page is the public feed; the former landing page is `/about`. Public pages for jobs, trainees and organisations are server-rendered and indexable, and use rounded “social” styling with a mint-to-gold card gradient and the triangle logo. Staff sign in on a separate, configurable address that is not linked from public pages.'));

  return [ch8, ch9, ch10];
};

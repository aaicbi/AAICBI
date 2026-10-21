// Technology guide, chapters 11 to 13: quality engineering, the decision register, and open items.
module.exports = (L) => {
  const { chapter, p, bullets, table, tip, warn, note, h3, h4, why } = L;

  const ch11 = chapter('x11', 11, 'Quality engineering and deployment',
    'How the team knows the engines behave: tests that need no database, real-browser checks, accessibility sweeps and a build that migrates safely.',
    h3('The “Core” pattern, and why it matters most') +
    p('The most important engineering habit in the repository is splitting each engine in two. A **Core** file holds the rules as pure functions: no database, no network, no AI, nothing imported. A second file does the fetching and saving and calls the core. The repository has 55 such core files, among them `examEngineCore`, `progressCore`, `earlyWarningCore`, `rateLimitCore`, `embeddingsCore`, `arenaCore`, `adsCore`, `growthCore`, `autoReview`, `pwa/installCore` and `rbac` rules.') +
    bullets([
      '**Fast tests.** A rule can be tested with a table of inputs in milliseconds.',
      '**Honest tests.** The test calls the same function the server calls; there is no copy of the rule in the test.',
      '**One place to change.** The trainee page, the organisation dashboard and the certificate engine cannot disagree about whether a module is complete.',
    ]) +
    why('written', 'The split is explained in the headers of `rateLimitCore.ts`, `embeddingsCore.ts`, `examEngineCore.ts` and `progressCore.ts`. `rateLimitCore.ts` records that the split came from “a real bug caught while actually running the tests”: importing the pure function had pulled in a database client that could not start in the test environment.') +
    h3('The layers of testing') +
    table(['Layer', 'Tool', 'What it covers', 'Where'], [
      ['Unit and rules tests', 'Vitest', 'About 1,360 test cases in 144 files: engines, permission rules, grading, formats, templates, schema guards.', '`tests/`, run with `npm test`'],
      ['Real-browser checks', 'Playwright driving Chromium', '111 scripts that sign in as real demonstration accounts on a local database and click through flows on an emulated iPhone, Android phone, tablet and desktop.', '`scripts/device-checks/`'],
      ['Accessibility sweep', 'axe-core through Playwright', 'Scans a list of pages for accessibility problems.', '`scripts/a11y-sweep.mjs`, `npm run a11y`'],
      ['Type checking', 'TypeScript strict', 'Every build fails on a type error, including misuse of a notification type or a permission key.', '`next build`'],
      ['Lint', 'ESLint through `next lint`', 'Style and common mistakes.', '`npm run lint`'],
    ]) +
    why('inferred', 'Rules tests give fast, exact feedback on the parts where a mistake costs the most (grades, access, money). Real-browser checks cover what unit tests cannot: the layout on a phone, a keyboard path, a redirect. Using the same Chromium that makes the user manuals keeps one browser toolchain.') +
    note('The repository contains no continuous-integration workflow files (there is no `.github/workflows` folder). Tests are run by the developer and by the hosting build, not by an automated pipeline on every push. This is listed in chapter 13.') +
    h3('Database changes: migrations') +
    p('The schema lives in `prisma/schema.prisma` with 178 models and enumerations changed through 109 migrations. Each migration is a reviewed SQL file. Extensions needed by features (`vector` for embeddings; trigram for search) are created inside migrations. A custom build script (`scripts/vercel-build.mjs`) runs the build on Vercel.') +
    h3('Deployment') +
    bullets([
      '**Hosting:** Vercel builds the Next.js app and runs it as serverless functions; five scheduled jobs are declared in `vercel.json`.',
      '**Database:** Neon Postgres, with pooled connections suited to serverless.',
      '**Files:** Vercel Blob for uploads such as pictures, certificates’ backgrounds and documents.',
      '**Secrets:** environment variables hold the Anthropic, Voyage, Ably, Resend, Paystack, VAPID and cron keys. Each optional service is checked at the moment it is used, and the Super Admin can see integration status on a screen.',
      '**Squash merges** to `main` through pull requests keep the history readable.',
    ]) +
    why('inferred', 'A single hosting vendor with a managed Postgres lets a small team ship without operating servers, and per-use pricing suits a platform that starts small.') +
    h3('What “graceful degradation” means in practice') +
    table(['If this is missing', 'What still works', 'What stops'], [
      ['Anthropic key', 'Everything except AI features; the guide answers from curated text.', 'AI grading, drafting, summaries, consultant.'],
      ['Voyage key', 'Questions can still be imported.', 'Meaning-based duplicate detection.'],
      ['Ably key', 'Arena and chat, by polling every 1.5 s.', 'Instant updates.'],
      ['Resend key', 'In-app notifications.', 'Email.'],
      ['VAPID keys', 'Everything else.', 'Phone push.'],
      ['WhatsApp credentials', 'Email and in-app messages.', 'WhatsApp messages (off by default).'],
      ['Paystack', 'Free courses and manual payment confirmation.', 'Online card payment.'],
    ]) +
    why('inferred', 'Each service sits behind a small function that checks its own configuration. This follows from the Postgres-only design: the platform needs only the database to run, and everything else adds capability.'));

  const ch12 = chapter('x12', 12, 'The decision register',
    'Every major choice on one page each: what was chosen, what else could have been used, the reason, and how well the reason is documented.',
    p('Read the last column carefully. **Written rationale** means the reason is recorded in the code or documents. **Engineering inference** means we are explaining why the choice fits, without a note from the original author. **No written rationale** means we found nothing written.') +
    table(['Decision', 'Chosen', 'Common alternatives', 'Why it fits', 'Evidence'], [
      ['Web framework', 'Next.js 14 App Router, React 18', 'Separate API and single-page app; Remix; Laravel', 'One codebase for pages and API, server rendering for speed on weak phones and for search engines.', 'Inference'],
      ['Language', 'TypeScript, strict', 'JavaScript', 'The compiler catches misuse of permission keys, notification types and database models before release.', 'Inference'],
      ['Database', 'PostgreSQL 16 through Prisma 5', 'MongoDB; MySQL; Firebase', 'Relational data with many links; transactions and unique keys give “exactly once”; vectors and fuzzy search live in the same database.', 'Inference; extension use is written'],
      ['Database host', 'Neon', 'Self-hosted Postgres; Supabase; RDS', 'Serverless pooling and branching suit Vercel.', 'Inference'],
      ['Hosting', 'Vercel (with Blob and crons)', 'A virtual server; AWS; Render', 'No servers to run; the app and its schedules deploy together.', 'Inference'],
      ['Styling', 'Tailwind with CSS-variable brand tokens', 'Component libraries', 'Small CSS, one dark and light theme by changing variables.', 'Inference'],
      ['Sessions', 'Signed cookie with `jose` (HS256), bcryptjs cost 10', 'Third-party sign-in; JWT in local storage', 'No external dependency; the cookie is not readable by scripts.', 'Inference'],
      ['Permissions', 'Deny-by-default `category.feature:action` with templates and audit', 'Fixed roles only', 'Organisations need different staff powers; anti-escalation stops a person granting more than they hold.', 'Written (RBAC documentation)'],
      ['Rate limiting', 'Postgres-backed window limiter', 'Redis', 'No extra service; the same database already exists.', 'Written (`rateLimitCore.ts`) for the split; inference for Postgres'],
      ['Server fetch safety', 'SSRF guard resolving DNS first', 'Checking the URL text only', 'A hostname can point at an internal address; the guard checks the resolved address.', 'Written (`ssrfGuard.ts`)'],
      ['Game formats', 'Quiz, matching, ordering, scenario with pure grading functions', 'One generic question type', 'Each format has different cheating risks and scoring; each can be tested alone.', 'Inference; see chapter 5'],
      ['Question quality', 'Writer and reviewer are different models', 'One model checks itself', 'The same model repeats its own mistakes.', 'Written (`bankModels.ts`)'],
      ['Real time', 'Ably publish-only from the server, SSE in the browser, polling fallback', 'Own WebSocket server; Firebase', 'Server decides, vendor only nudges, nothing private travels on the channel.', 'Written (`realtimeCore.ts`)'],
      ['Match fairness', 'Server deadlines, versioned saves, private views', 'Trust the client', 'Cheating and double-tap races are closed on the server.', 'Written (`arenaCore.ts`, `arenaView.ts`)'],
      ['Certificate editor', 'Fabric.js 7 canvas, saved as data', 'HTML/CSS editor; a fixed template', 'Free placement of text, images and QR codes with a layout that can be re-rendered as a PDF.', 'Inference; see chapter 7'],
      ['Certificate output', '@react-pdf/renderer, `qrcode`, `sharp`', 'Screenshots of a web page', 'Real PDF text, small files, QR code for verification.', 'Inference'],
      ['Document reading', 'mammoth, word-extractor, unpdf, jszip, node-html-parser', 'A single converter service', 'Reads Word and PDF lessons inside the app with no outside service.', 'Inference'],
      ['AI grading model', 'claude-sonnet-4-5', 'Haiku (cheaper)', 'A grade must be good.', 'Written'],
      ['AI summaries model', 'claude-haiku-4-5', 'Sonnet', 'High volume, simple task.', 'Written'],
      ['Embeddings', 'Voyage voyage-3-lite, `vector(512)`, cosine, threshold 0.93', 'Larger embedding models; text matching', 'Cheap and good enough for “same question reworded”.', 'Dimension written; model choice inference'],
      ['Post review', 'Rule-based scorer; people reject', 'AI moderation; manual only', 'Instant for good posts, never rejects by itself.', 'Written'],
      ['Email', 'Resend', 'SMTP; SendGrid', 'Simple sending API.', 'No written rationale'],
      ['Payments', 'Paystack with signed webhooks', 'Flutterwave; Stripe', 'Nigerian cards and transfers.', 'Inference; signature approach written'],
      ['Charts', 'Recharts', 'Chart.js; D3', 'React-native chart components.', 'No written rationale'],
      ['Icons', 'lucide-react', 'Icon fonts', 'Tree-shaken SVG icons.', 'No written rationale'],
      ['Fonts', 'Fraunces and Manrope through next/font', 'Hosted font links', 'Self-hosted, no layout shift.', 'Inference'],
      ['Testing', 'Vitest, Playwright, axe-core', 'Jest; Cypress', 'One toolchain for rules and browsers.', 'Inference'],
      ['Offline and install', 'Service worker PWA', 'Native apps', 'No app store, one codebase, works on low-end phones.', 'Inference'],
    ]) +
    tip('When a reviewer asks “why was X chosen?”, the **Evidence** column tells you how firm the answer is. Where it says Inference, the honest reply is that the choice fits the requirement, not that the original author recorded this reason.'));

  const ch13 = chapter('x13', 13, 'Open items and honest limits',
    'What this guide could not prove, where the platform is simpler than it sounds, and what to check next.',
    h3('Things built but not proven live') +
    bullets([
      '**WhatsApp** has been tested against a stand-in server only; no real message has been sent through Meta.',
      '**Machine translation** drafts for Yoruba, Igbo, Hausa and French use Google Translate and Pidgin uses Claude; the code requires human review before trusting them, and this guide did not check how much has been reviewed.',
      '**Load.** The platform was read, not load-tested. The design choices (serverless, polling fallback, bounded cron jobs) suggest it will scale gradually, but no number is claimed.',
    ]) +
    h3('Where the simple version is the real one') +
    bullets([
      'The **post auto-reviewer** is a scorer over word lists, not an AI.',
      'The **guide** answers from curated text; AI is used only to advise the Super Admin.',
      '**Search** is Postgres trigram and indexes, not a search engine.',
      '**Rate limiting** uses the database, so it is shared across servers but adds a small database cost to each limited request.',
    ]) +
    h3('Gaps to consider') +
    bullets([
      '**No continuous integration.** Nothing runs the test suite automatically on every change.',
      '**Model names are written in files** for most AI features; moving to a newer model means a code change, except for the question bank and the consultant, which read an environment variable.',
      '**Vendor concentration.** Vercel, Neon and Anthropic each have one point of dependence. The graceful-degradation table in chapter 11 shows what survives losing a service; losing the database stops everything.',
      '**Email, charts and icons** have no recorded reason for the choice. They are conventional picks.',
    ]) +
    h3('How to verify any statement in this guide') +
    L.steps([
      'Find the file named in the box (for example `bankModels.ts`) in the repository’s `src/lib` folder.',
      'Read the comment at the top; written rationales are quoted from there.',
      'Run `npm test` to see the rules pass, and open the matching file in `tests/`.',
      'For counts (pages, models, migrations, tests) re-run the count on the current code; they will change.',
    ]));

  return [ch11, ch12, ch13];
};

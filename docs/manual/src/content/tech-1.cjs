// Technology guide, chapters 1 to 3: how to read it, the architecture, the core platform stack.
module.exports = (L) => {
  const { chapter, p, bullets, table, tip, warn, note, h3, h4, why, svgFigure } = L;

  const ch1 = chapter('x1', 1, 'About this guide',
    'What this document covers, how each claim was checked, and how to read the reasons given for each tool.',
    h3('Purpose') +
    p('The AAICBI Ecosystem is a large, real platform: learning management, an examination engine, a Game Studio, a Certificate Studio, a real-time game arena, a social feed, search, payments, messaging and several AI assistants. This guide lists the technology tools used to build it, explains what each tool does inside the platform, and explains **why it is a good solution** for AAICBI’s situation — a small team serving learners across Africa, many on phones and slow connections, with limited operations staff.') +
    p('It pays special attention to the **Game Studio**, the **Certificate Studio** and the platform’s **engines**: the exam engine, assignment engine, course engine, guide engine, search engine, feed and moderation engine, notification engine, payment engine and permission engine.') +
    h3('How the reasons are labelled') +
    p('A document like this can easily drift into marketing. To avoid that, every reason for a decision carries one of three labels:') +
    why('written', 'The reason is recorded by the engineers in the platform’s own code comments or documents. We quote or paraphrase it and name the file.') +
    why('inferred', 'No reason is written down, but the choice clearly fits the platform’s needs. We say what we think the reason is. This is our reading, not the engineers’ words.') +
    why('none', 'Nothing is written and we do not want to guess further. The tool is listed and its role described only.') +
    h3('How it was checked') +
    bullets([
      'Every number here (pages, tables, tests, thresholds) was read from the repository: the application code, `prisma/schema.prisma`, `package.json`, the documents in `docs/`, the automated tests in `tests/` and the browser checks in `scripts/device-checks/`.',
      'Behaviour is described from the code. The guide did not load-test the platform and does not claim performance numbers that the repository does not contain.',
      'Where documents and code disagree, the code is treated as correct and the difference is listed in the final chapter.',
      'External services that have not been tested against the real provider (for example WhatsApp through Meta, and Google Translate) are marked as such.',
    ]) +
    h3('The platform at a glance') +
    table(['Measure', 'Value (from the repository)'], [
      ['Web pages', '220'],
      ['Server endpoints (API route handlers)', '482'],
      ['Database tables (Prisma models) and enumerations', '178 and 69'],
      ['Database migrations (steps of change history)', '109'],
      ['Automated test files', '144 (about 1,360 test cases), plus 111 browser and device check scripts'],
      ['Files that use the shared error wrapper', '439'],
      ['Pure “core” logic files kept apart from database code', '55'],
      ['Languages for the interface', 'English, Yoruba, Igbo, Hausa, French and Nigerian Pidgin'],
      ['Account types', 'Trainee, training organisation, employer, investor, startup founder; staff roles Super Admin, Admin, Instructor'],
      ['Scheduled jobs', '5 (daily access sweep, analytics alerts, weekly analytics report, arena sweep, hourly growth messages)'],
    ]) +
    h3('The technology tools in one table') +
    table(['Layer', 'Tool', 'What it does in AAICBI'], [
      ['Application framework', 'Next.js 14 (App Router) and React 18', 'Pages, server rendering and every server endpoint in one codebase.'],
      ['Language', 'TypeScript (strict mode)', 'Typed code across pages, endpoints and database access.'],
      ['Styling', 'Tailwind CSS, CSS variables, Fraunces and Manrope fonts', 'Brand colours, dark and light themes, readable type.'],
      ['Database', 'PostgreSQL 16 with Prisma 5; pgvector and pg_trgm extensions', 'All data, migrations, duplicate detection for questions and fuzzy search indexes.'],
      ['Hosting', 'Vercel (hosting, cron, Blob file storage) with Neon (managed Postgres)', 'Deployment, scheduled jobs, uploaded files.'],
      ['Identity and security', 'jose (signed session tokens), bcryptjs, zod, Postgres-backed rate limiter', 'Sign-in, passwords, input validation, abuse limits.'],
      ['AI', 'Anthropic Claude (Sonnet, Haiku, Opus) through the official SDK; Voyage AI for embeddings', 'Question extraction, grading help, feedback, assistants, content review.'],
      ['Real time', 'Ably (server only) with a polling fallback', 'Live two-player games and chat updates.'],
      ['Email, push and chat messages', 'Resend; web-push (VAPID) with a service worker; WhatsApp Cloud API', 'Notifications and reminders.'],
      ['Payments', 'Paystack (naira), plain HTTP integration', 'Course payments, subscriptions, organisation fees, revenue split.'],
      ['Documents and media', '@react-pdf/renderer, mammoth, word-extractor, unpdf, jszip, node-html-parser, qrcode, sharp, next/og', 'Reports, certificates’ QR, Word and PDF import, picture shrinking, result cards.'],
      ['Certificate editor', 'Fabric.js 7', 'The drag-and-drop canvas of the Certificate Studio.'],
      ['Charts and icons', 'Recharts, lucide-react', 'Analytics charts and the interface icon set.'],
      ['Quality', 'Vitest, Playwright, axe-core', 'Unit tests, real-browser checks and accessibility sweeps.'],
    ]));

  const ch2 = chapter('x2', 2, 'Architecture and design principles',
    'The shape of the system, and the ten habits in the code that make it dependable.',
    h3('The system in one picture') +
    svgFigure(`<svg viewBox="0 0 900 470" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif" role="img" aria-label="Architecture diagram: people use the web app on Vercel, which stores data in PostgreSQL and calls outside services">
<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#005650"/></marker></defs>
<rect x="10" y="10" width="880" height="70" rx="10" fill="#EAF0EB" stroke="#005650"/>
<text x="450" y="34" text-anchor="middle" font-size="15" font-weight="700" fill="#014A43">People</text>
<text x="450" y="58" text-anchor="middle" font-size="12.5" fill="#0C241F">Trainees · Training organisations · Employers · Investors · Startup founders · AAICBI staff · Visitors</text>
<path d="M450 80 L450 112" stroke="#005650" stroke-width="2" marker-end="url(#a)"/>
<text x="462" y="102" font-size="11" fill="#4a5e59">browser or installed phone app (PWA)</text>
<rect x="10" y="114" width="880" height="170" rx="10" fill="#fff" stroke="#005650" stroke-width="2"/>
<text x="24" y="138" font-size="14" font-weight="700" fill="#014A43">The AAICBI web application (Next.js 14, React 18, TypeScript) on Vercel</text>
<rect x="26" y="150" width="270" height="52" rx="8" fill="#EAF0EB"/><text x="161" y="172" text-anchor="middle" font-size="12.5" font-weight="700">Pages (220)</text><text x="161" y="190" text-anchor="middle" font-size="11">server and client components</text>
<rect x="315" y="150" width="270" height="52" rx="8" fill="#EAF0EB"/><text x="450" y="172" text-anchor="middle" font-size="12.5" font-weight="700">Endpoints (482)</text><text x="450" y="190" text-anchor="middle" font-size="11">checks who you are, then acts</text>
<rect x="604" y="150" width="270" height="52" rx="8" fill="#EAF0EB"/><text x="739" y="172" text-anchor="middle" font-size="12.5" font-weight="700">Middleware</text><text x="739" y="190" text-anchor="middle" font-size="11">session check, redirects, headers</text>
<rect x="26" y="212" width="848" height="60" rx="8" fill="#F6E8CC"/>
<text x="450" y="233" text-anchor="middle" font-size="12.5" font-weight="700" fill="#6E480E">Engines (pure “core” rules + database halves)</text>
<text x="450" y="252" text-anchor="middle" font-size="11" fill="#3a2a08">Exam · Assignment · Course · Game and Quest · Arena · Certificate · Guide · Search · Feed · Notifications · Payments · Permissions</text>
<path d="M300 284 L300 330" stroke="#005650" stroke-width="2" marker-end="url(#a)"/>
<path d="M620 284 L690 330" stroke="#005650" stroke-width="2" marker-end="url(#a)"/>
<rect x="10" y="332" width="340" height="128" rx="10" fill="#EAF0EB" stroke="#005650"/>
<text x="180" y="356" text-anchor="middle" font-size="14" font-weight="700" fill="#014A43">PostgreSQL 16 (Neon) via Prisma</text>
<text x="180" y="378" text-anchor="middle" font-size="11.5">178 tables · 109 migrations</text>
<text x="180" y="396" text-anchor="middle" font-size="11.5">pgvector · pg_trgm indexes</text>
<text x="180" y="414" text-anchor="middle" font-size="11.5">rate limits, audit log, settings,</text>
<text x="180" y="432" text-anchor="middle" font-size="11.5">notifications all live here</text>
<rect x="370" y="332" width="520" height="128" rx="10" fill="#fff" stroke="#005650"/>
<text x="630" y="356" text-anchor="middle" font-size="14" font-weight="700" fill="#014A43">Outside services (each in one file, each optional)</text>
<text x="630" y="380" text-anchor="middle" font-size="11.5">Anthropic Claude · Voyage embeddings · Ably real time</text>
<text x="630" y="400" text-anchor="middle" font-size="11.5">Resend email · Web push · WhatsApp Cloud API · Google Translate</text>
<text x="630" y="420" text-anchor="middle" font-size="11.5">Paystack payments · Vercel Blob files</text>
<text x="630" y="444" text-anchor="middle" font-size="11" fill="#4a5e59">If a service is missing, the feature steps back and the platform keeps working</text>
</svg>`, 'How the pieces fit. The database is the only infrastructure the platform cannot run without; every outside service is optional and isolated.') +
    h3('Ten design habits that show up across the whole codebase') +
    h4('1. Pure “core” rules, separate from database code') +
    p('Each engine keeps its rules in a file that never touches the database (for example `examEngineCore.ts`, `rateLimitCore.ts`, `embeddingsCore.ts`, `quest/core.ts`, `arena/*Core.ts`) and a second file that reads and writes data. There are 55 such core files. This lets the rules be tested in milliseconds without a database and tuned in one place.') +
    why('written', 'The split came from a real failure: a test that imported a pure function pulled in a database client that could not be generated in that environment. The headers of `rateLimitCore.ts` and `embeddingsCore.ts` say so. `quest/core.ts` adds that every number of the learning design “can be tested and tuned in one place”.') +
    h4('2. The server is the authority; the browser is never trusted') +
    p('Timers, scores, answer keys, permissions and ownership are decided on the server. Examples: the exam clock is the server clock; answer keys are never sent while a test is in progress; an organisation’s identity comes from its session, never from a request field.') +
    why('written', '`examEngine.ts`: “A student changing their device clock cannot extend their own time.” `rbac/guard.ts`: “The client is never trusted for who someone is, which organization they belong to, or what they may do.”') +
    h4('3. Deny by default') +
    p('Permissions start empty. A person can do something only if a rule grants it, and permissions are read from the database on every request, so a revoked permission applies to an open session immediately.') +
    why('written', '`docs/rbac-audit-and-plan.md`: “Deny by default”; “a revoked permission applies to existing sessions at once. Nothing is cached across requests.”') +
    h4('4. Every outside service is optional and isolated') +
    p('Email, push, real time, embeddings, WhatsApp, translation, file storage and the AI provider each live behind one small file. If a key is missing, that feature quietly steps back and the rest keeps working. Only two settings are strictly required to run the platform: the signing secret and the AI key (for AI features).') +
    why('written', '`notifications/email.ts`: a broken registration or password reset “because an email provider hiccupped” is worse than a skipped email. `arena/realtime.ts`: “everything goes through the small functions below so the provider can be swapped”.') +
    h4('5. Postgres as the one piece of infrastructure') +
    p('Rate limits, audit events, platform settings, notification logs, push subscriptions and cached conversions all live in the database. There is no separate Redis, queue or search server to run, secure or pay for.') +
    why('written', '`rateLimit.ts`: Postgres is “already provisioned … no Redis, no new service, no new env vars”.') +
    h4('6. Idempotent actions: doing it twice does no harm') +
    p('The same patterns repeat: create-then-ignore-duplicate (a unique rule in the database), “update only if still in this state” (a status guard), unique event keys, and optimistic version numbers. Submitting an exam twice, tapping Pay twice, or a webhook arriving twice cannot produce two results.') +
    why('written', 'Comments throughout the exam, certificate, payment and arena code explain that a double-tap race “burns attempts” or that two simultaneous sends “cannot spend the same credits twice”.') +
    h4('7. Never let a side effect break the main action') +
    p('Sending an email, awarding a badge or writing an audit row is wrapped so that its failure never undoes the action the person actually took. Audit writing, push, analytics and AI summaries all follow this rule.') +
    h4('8. Privacy by design') +
    p('AI assistants receive aggregated numbers, not names or question text. The service worker never caches anything personal. Real-time messages carry no answers. Notification error messages are stripped of email addresses and phone numbers before being stored. Public pages select only the fields they need.') +
    h4('9. Honest about what is untested') +
    p('Comments repeatedly say “built to the provider’s documentation, not verified end to end” for Paystack, WhatsApp, Google Translate and similar integrations. This guide repeats those caveats rather than hiding them.') +
    h4('10. A paper trail for why') +
    p('Comments cite the audit finding or milestone that caused each safeguard (for example “M9 audit finding #4”). That makes the reason for a rule discoverable, which is the foundation of this guide.') +
    tip('When you see the three labels in later chapters, the “Written rationale” boxes come from exactly this paper trail.'));

  const ch3 = chapter('x3', 3, 'The core platform stack',
    'The foundation tools, one by one: what they do here, why they fit, and what the trade-off is.',
    h3('Next.js 14 and React 18: one codebase for pages and server') +
    p('Next.js with the App Router renders pages on the server and also hosts every API endpoint (482 of them) in the same project. The platform has 220 pages; 377 files are client components for interactive parts, and the rest are server components that read the session and the database directly. Most pages are dynamic (`force-dynamic`) because they depend on who is signed in; only a few public pieces are cached.') +
    table(['Next.js feature used', 'Where and why'], [
      ['Server components and route handlers', 'Data pages read the session and database directly; endpoints enforce permissions.'],
      ['Middleware (`src/middleware.ts`)', 'Verifies the signed session cookie, redirects signed-out visitors, hides the staff sign-in page, and passes the current path to pages and endpoints.'],
      ['`next/font`', 'Self-hosts Fraunces and Manrope at build time: no outside font request, no layout jump.'],
      ['`next/og`', 'Creates share-card images (1200×630 and 1080×1920) for the growth funnel.'],
      ['`unstable_cache` with tags', 'Short caches for the public feed (60 s), landing data (300 s), guide config (about 60 s); signed-in views are never cached.'],
      ['`rewrites` and `headers`', 'Short `/@handle` profile addresses; the configurable staff sign-in address; service-worker and public-file caching; `noindex` on staff areas.'],
      ['`optimizePackageImports`', 'Only the icons and chart parts a page uses are sent to the phone.'],
    ]) +
    why('none', 'The repository does not record why Next.js 14 or React 18 were chosen over other frameworks.') +
    why('inferred', 'One TypeScript codebase serves the pages, the API and server rendering on one Vercel deployment. For a small team this removes a separate backend service, shares types between screens and endpoints, and gives fast first loads on phones through server rendering.') +
    h3('TypeScript in strict mode') +
    p('`tsconfig.json` sets `strict: true`. The deployment guide asks every deployer to run the type check. Combined with zod validation at every endpoint, data is checked at the edge and typed inside.') +
    why('inferred', 'Types catch whole classes of mistakes (a missing field, a wrong role name) before release, which matters when 482 endpoints share the same data model.') +
    h3('Tailwind CSS with CSS-variable design tokens, dark mode and two fonts') +
    p('Brand colours are CSS variables (`--brand-teal`, `--brand-ink`, …) mapped into Tailwind as `rgb(var(--brand-x) / <alpha-value>)`. Dark mode is the default, switched by a first-party `theme` cookie read by a tiny inline script before the first paint. A test (`designTokens.test.ts`) fails if any text and background pair drops below the 4.5:1 contrast ratio in either theme.') +
    why('written', '`tailwind.config.ts`: dark mode “doesn’t require touching the 369 existing bg-brand-* … usages”. `layout.tsx`: a raw inline script rather than a React effect “to avoid a flash of wrong theme”. The config describes Fraunces as a warm serif that reads as “credential” and “crafted” (used for headings and certificates) and Manrope as a clean, friendly sans that stays functional in dense screens.') +
    h3('PostgreSQL 16 with Prisma 5') +
    p('All data lives in PostgreSQL, accessed through Prisma. The schema has 178 models, 69 enumerations and 222 indexes; about 47 columns hold flexible JSON where the shape legitimately varies (certificate layouts, audit before/after values, game item content). The 109 migrations are applied with `prisma migrate deploy`.') +
    table(['Capability', 'How it is used'], [
      ['Typed queries', 'The Prisma client gives typed, injection-safe queries across the codebase.'],
      ['Migrations', 'Additive, reviewable steps; production builds run `migrate deploy` and fail the build if a migration fails, so the previous release keeps serving.'],
      ['pgvector', '`Question.embedding vector(512)` supports duplicate-question detection.'],
      ['pg_trgm', 'Trigram indexes for fuzzy search on names, titles and handles, created by a migration “built never to fail or block a deploy”.'],
      ['Unique constraints and transactions', 'The foundation of the “do it twice, get one result” guarantees (certificates, attempts, payments, ladder points).'],
      ['Advisory locks', 'The credit wallet takes a database lock so two simultaneous sends cannot double-spend.'],
    ]) +
    why('written', '`schema.prisma` and `docker-compose.yml`: pgvector is used for duplicate detection (the Prisma client has no native vector type, so raw queries are used); the local database image is `pgvector/pgvector:pg16` because plain Postgres lacks the extension. `DEPLOYMENT.md`: use `migrate deploy`, not `db push`, because the latter “skips the migration history (and the data steps inside some migrations)”.') +
    why('none', 'No document compares Prisma with other data layers.') +
    why('inferred', 'Prisma’s generated types and migration history suit a schema that changes every week; Postgres’ constraints and transactions give the platform its safety guarantees without extra systems.') +
    h3('Neon and Vercel: managed, low-operations hosting') +
    p('Production runs on Vercel with Neon as the managed Postgres. `scripts/vercel-build.mjs` generates the Prisma client, runs `prisma migrate deploy` only for production builds, then builds the app. It rewrites Neon’s pooled address to the direct address for migrations, retries three times five seconds apart, and never touches the database for previews or local builds. Five scheduled jobs are declared in `vercel.json` and are protected by a secret.') +
    why('written', '`vercel-build.mjs`: the pooled host sits behind pgbouncer, which cannot hold the lock `migrate deploy` takes (error P1002); “A sleeping Neon database can miss the first migration lock”, hence the retries; a failed migration fails the build “so previous deployment keeps serving”. `DEPLOYMENT.md`: Neon supports the two extensions the app needs (`vector`, `pg_trgm`). `performance.md`: put the Vercel function region in the same region as Neon.') +
    why('inferred', 'Managed hosting means no servers to patch and automatic HTTPS and scaling, which fits a team without a dedicated operations engineer. The trade-off is cold starts on a sleeping free-tier database, which the performance guide documents.') +
    h3('Vercel Blob: direct-to-storage uploads') +
    p('Pictures, resumes, flyers, certificate backgrounds, ads and videos are stored in Vercel Blob. Browsers upload straight to Blob with a short-lived token, so the file never passes through a server function.') +
    why('written', '`materials/upload-token/route.ts`: this is “what actually fixes the 4.5MB platform ceiling”. Presigned tokens are used instead of the static-token helper; database work is deliberately not done in the upload-complete callback because that callback never reaches a local machine.') +
    h3('Dependencies at a glance (production)') +
    table(['Package', 'Role'], [
      ['next, react, react-dom', 'Application framework and UI library.'],
      ['@prisma/client (prisma for tooling)', 'Database access and migrations.'],
      ['@anthropic-ai/sdk', 'Claude calls for grading, extraction, assistants and review.'],
      ['ably', 'Server-side publishing of “something changed” signals.'],
      ['jose, bcryptjs', 'Signed session tokens; password hashing.'],
      ['zod', 'Validation of every request and of AI output.'],
      ['resend, web-push', 'Email; browser push notifications.'],
      ['@vercel/blob, sharp', 'File storage; picture resizing.'],
      ['@react-pdf/renderer, mammoth, word-extractor, unpdf, jszip, node-html-parser, qrcode', 'PDF creation; Word and PDF reading; Office file reading; QR codes.'],
      ['fabric', 'The certificate design canvas.'],
      ['recharts, lucide-react', 'Charts and icons.'],
    ]) +
    note('Of the 23 production dependencies, none is a large framework beyond Next.js and React. The small number is itself a design decision: fewer moving parts to secure and upgrade.'));

  return [ch1, ch2, ch3];
};

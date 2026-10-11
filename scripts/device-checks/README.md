# Emulated-device checks

Scripted browser runs that drive the real app on emulated phones and tablets (iPhone, Pixel, Galaxy, iPad Mini, iPad), signed in as real seeded accounts, against a real database. They catch layout, navigation, permission and workflow problems that unit tests cannot. They use Chromium with each device's screen size, pixel ratio, touch and user agent, so they do **not** replace testing on real phones (see `docs/pwa-device-testing.md`): Safari's engine, real keyboards, push delivery, "Add to Home Screen" and notches are not covered.

## Setup (a throwaway database; never point this at production)

1. A PostgreSQL 16 with the `vector` extension, empty database `aaicbi_dev`, then `DATABASE_URL=... npx prisma migrate deploy`.
2. Seed: `npx tsx prisma/seed.ts`, `npx tsx prisma/seed-demo-ecosystem.ts`, and `npx tsx scripts/device-checks/seed-extra.ts` (employer introduction, a job, the organization's public page and an event). The accounts are the `*@dev.test` ones; password `Passw0rd!dev`. The dev accounts come from the dev seed used while building (`super@dev.test`, `org@dev.test`, `employer@dev.test`, `t0@dev.test` ...).
3. `npx next build` and `npx next start -p 3113` with `DATABASE_URL` and a 32+ character `AUTH_SECRET`.

## Run

Environment: `BASE_URL` (default `http://localhost:3113`), `PSQL_ARGS` (psql connection flags for the throwaway database), `CHROMIUM_PATH` (optional), `OUT_DIR` (screenshots, default `/tmp`).

```
node scripts/device-checks/trainee.cjs            # phone home, bottom bar, More sheet, iPad portrait vs landscape
node scripts/device-checks/employer.cjs           # employer home, messaging rules, drafts, offline send
node scripts/device-checks/forms-and-offline.cjs   # stepped job posting, install card, offline recovery, cache contents, slow 3G
node scripts/device-checks/add-to-home-screen.cjs   # Install app button, steps sheet on iPhone and Android, none on laptop
node scripts/device-checks/theme-and-hydration.cjs   # dark theme kept and no hydration errors on public pages, three device types
node scripts/device-checks/course-cards.cjs        # course cards: no overflow at 5 sizes (load seed-course-ui.sql first)
node scripts/device-checks/course-video.cjs        # lesson video: 16:9, modal, fullscreen, plays in-platform
node scripts/device-checks/guide-knowledge-api.cjs   # review queue, grouping, approval, versions, restore, privacy, access
node scripts/device-checks/guide-chat.cjs            # Take me there / Show me, role-aware answers, honest unknowns
node scripts/device-checks/guide-tour.cjs            # multi-step tour, auto-advance, reduced motion, phone More fallback
node scripts/device-checks/guide-admin.cjs           # Guide Bot Knowledge screens
# Claude consultant: start `node scripts/device-checks/fake-claude.cjs`, run the app with ANTHROPIC_API_KEY=fake ANTHROPIC_BASE_URL=http://127.0.0.1:4599 (the "nokey" phase of guide-consultant-api.cjs needs it unset)
node scripts/device-checks/guide-consultant-api.cjs flow   # switch, gating, scrubbed context, sanitising, changes nothing, failures, rate limit
node scripts/device-checks/guide-consultant-ui.cjs         # proposals, approve through the form, merge, reject, advice, off
node scripts/device-checks/organization.cjs       # organization home, messaging scope, profile preview, Loop guide
node scripts/device-checks/videos-and-reports.cjs # trainee video -> organization -> Super Admin, and reports
node scripts/device-checks/builder-tools.cjs      # course builder / exam tools on phone and tablet
node scripts/device-checks/overflow-sweep.cjs     # every page in scripts/a11y-pages.json on iPhone SE and iPad Mini
```

Each prints `PASS`/`FAIL` lines. The login throttle is cleared in the throwaway database between runs.

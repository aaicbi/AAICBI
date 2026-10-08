# Public ecosystem (phases 0 to 8)

Organization public pages, trainee education videos, the community feed, and a demo world to try them with. Everything ships **off**.

## Rolling out

1. Migrations are applied automatically by the production build (see *Database migrations on deploy* below). To run them by hand instead, `prisma migrate deploy` (migrations `20261009090000_public_ecosystem`, `20261009100000_ecosystem_feed` and `20261009110000_course_skills` and `20261009120000_ranking_config` and `20261009130000_org_watchlist` and `20261009140000_ecosystem_events` and `20261009150000_comments_events`). It only adds tables and columns with defaults, so the current site is unaffected.
2. Deploy the code. Nothing public changes yet: `/organizations` and `/learn` return 404.
3. As SUPER_ADMIN open **Platform > Ecosystem** and switch on public organization pages, education videos and/or the community feed. Switching them off again hides the pages at once; no data is deleted.

## How it works

- **Organization page** `/organizations/[slug]`: organizations edit it under *Organization > Public profile* and choose whether it is public. Only name, logo, website, tagline, description, location, cover, programs and published videos are shown. Contact details, billing and trainee lists are never selected.
- **Education video**: an organization picks one of *its own* enrolled trainees and pastes a YouTube link (existing validator in `materialUrl.ts`; only the video id is stored, nothing is downloaded). Author is the trainee, publisher is the organization.
- **Trainee consent**: the trainee is notified and must allow it (*Video requests*) before anything is public, and can withdraw later.
- **Moderation ("Trusted")**: for a SUPER_ADMIN-verified organization a video goes live as soon as the trainee agrees; for any other it waits in *Ecosystem > Videos awaiting review*. SUPER_ADMIN can pull any video.
- **Isolation**: the organization comes from the session on the server. A trainee is "its own" only if enrolled in a course the organization owns (`src/lib/ecosystem/orgScope.ts`).

## Feed and discovery (phase 3)

- **`/feed`**: one mixed stream with filters (All, Learn, Organizations, Jobs, Projects). Newest first, items from followed organizations get a three-day boost, and no more than three of one type appear in a row.
- **What is in it**: published education videos, verified organizations, approved showcase projects, and jobs. Jobs show only to a signed-in trainee who has turned on discoverability (the same rule as the trainee job board). Pitches are not shown: they are investor-only.
- **Trending education** (top of `/learn`): recent published videos ranked by dampened engagement (log-scaled views, likes and saves, decaying with age), at most two per organization, so repeat taps or one organization posting a lot cannot push itself up.
- **Follow, like, save**: signed-in trainees only; one row per person per item, so repeating a tap changes nothing. Everyone else sees a sign-in prompt.
- **Mobile**: a sticky Feed / Learn / Organizations strip under the header. A fixed bottom bar was left out so it cannot collide with the cookie banner and help button.

## Recommendations (phase 4)

- **Program skills**: under *Organization > Program skills* an organization says which skills each of its programs teaches. This reuses the shared skill list that trainee profiles and job postings already use (matched ignoring case).
- **Under a video** (`/learn/[id]`): *Interested in learning this?* suggests up to two published programs from organizations with a public page. Relevance comes only from shared skills, the same category, and the program the organization tagged the video with; the publishing organization gets a small nudge, and nothing about size, activity or payment counts. At most one program per organization. Below that: *More on these skills* (similar videos), *Jobs that use these skills* (signed-in discoverable trainees only) and, for a signed-in employer, *Find similar talent*, which opens the employer Discover page filtered to that skill.

## Visibility score and Featured (phase 5)

- **Score (0 to 100), computed on demand** from existing data; no job or snapshot table. Six parts, each weighted by SUPER_ADMIN under *Ecosystem > Organization visibility score*: content quality (description, skill tags, linked program), engagement (unique signed-in people, views, followers), consistency (distinct weeks with a video), trainee participation (distinct trainees), verified achievements (certificates issued) and program readiness (programs with skills).
- **Rises with activity, not volume**: only published videos count, at most the weekly cap (default 2) per week, an organization's own trainees never lift its score, and engagement is log-saturated, so posting more can't be spammed upward.
- **Never shown publicly.** Organizations see badges (Consistent educator, Active this month, Trainee-led learning, plus Verified). **Featured** organizations (shown first on `/organizations`) must meet the published criteria: minimum score, minimum recent videos, optionally verified, capped in number.
- Defaults apply until the config is saved (`PlatformSettings.ecosystemRankingConfig`, nullable JSON).

## Employer and investor discovery (phase 6)

- **Organizations** (`/employer/organizations`, `/investor/organizations`): approved employers and investors search organizations with a public page by the skill their programs teach. Featured organizations come first. Each card shows programs, videos, badges (never the score) and links to the public page. Only public information is read; contact details and trainee lists are never selected. The sidebar link appears only while organization pages are on; with them off the API returns 404.
- **Employers**: each skill chip opens the employer Discover page filtered to that skill, which still shows only trainees who chose to be discoverable.
- **Investors**: a private **watch list** of organizations (separate from the pitch watch list). Watching is idempotent and nobody else, including the organization, can see it. Pitch sectors and stages were already filterable on the investor dashboard.

## Content dashboard and analytics (phase 7)

- **Organization dashboard** (*Organization > Content and visibility*): the last 30 days of page visits, video views, program clicks, new followers, likes and saves and new enrollments, the click rate from visits to programs, top videos, programs people clicked, the organization's own visibility breakdown with badges, and up to three plain suggestions for what would help most. Enrollments count everyone who joined its programs from any source; the page says so.
- **Counting is anonymous**: `EcosystemEvent` stores only the type, organization and optional video or program (no IP, account or text). A visit counts once per browser session and per 30 minutes per caller; a click on a program is attributed to the organization that owns the course, not to anything the caller sends. Nothing is counted while organization pages are off.
- **Platform view** (Superadmin, *Ecosystem*): the same totals across real organizations with the most visited ones. Demo organizations are excluded so these numbers stay real.

## Search, comments and events (phase 8)

- **Search** (`/search`): one box over public organizations, videos, programs and events, with type filters. Plain case-insensitive matching on what each public page already shows (names, taglines, places, titles, skills); no new index or extension, and nothing a visitor could not already open. Hidden when organization pages are off; videos only when education is on.
- **Comments**: on `/learn/[id]`, readable by anyone and written by signed-in trainees only. Plain text, 2 to 500 characters, links rejected, ten per hour per person. Authors can delete their own; anyone signed in can report a comment, which lands in the existing report queue (context `EDUCATION_COMMENT`, one open report per person and comment); SUPER_ADMIN can hide any comment from *Ecosystem*.
- **Events**: organizations add events under *Organization > Events* (title, UTC start and optional end, place, optional https registration link). They show on the organization's *Events* tab and on `/events`. Registration happens on the organization's own link; nothing is collected here. Events are listed until they are over; SUPER_ADMIN can take any down.

## Demo accounts

```
npm run db:seed-demo     # create (safe to repeat)
npm run db:reset-demo    # remove only the demo rows
```

Password: `Demo-Pass-123!` locally. In production the seed refuses unless `ALLOW_DEMO_SEED=1` and `DEMO_PASSWORD` are set.

| Role | Login page | Email |
|---|---|---|
| Organization | `/org/login` | `demo-org@demo.aaicbi.invalid` |
| Trainee | `/trainee/login` | `trainee1@` to `trainee5@demo.aaicbi.invalid` |
| Employer | `/employer/login` | `demo-employer@demo.aaicbi.invalid` |
| Investor | `/investor/login` | `demo-investor@demo.aaicbi.invalid` |

Demo rows are flagged `isDemo` or use the `.invalid` domain (cannot receive email), and the reset matches only those.

## Not in this change

Achievements and events in the feed, employer and investor feed views, an investor public profile, and comment replies or likes.

## Database migrations on deploy

Vercel runs `npm run vercel-build` (`scripts/vercel-build.mjs`), which on a **production** deployment runs `prisma migrate deploy` before `next build`. If a migration fails the build fails, so the previous deployment stays live. Preview deployments and local builds never touch the database.

Optional environment variables in Vercel:

- `MIGRATE_DATABASE_URL`: connection used for migrations only. Set it to Neon's direct (non-pooler) host if migrations time out or lose their lock on the pooled one. Falls back to `DATABASE_URL`.
- `SKIP_DB_MIGRATE=1`: build without migrating (escape hatch).

Migrations must stay additive (new tables and columns with defaults) so the old deployment keeps working while a new one builds.

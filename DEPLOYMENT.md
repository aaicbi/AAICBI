# AAICBI — Deployment Guide

Four parts: **run it on your own machine** (Part 1), **put it live** on the
internet (Part 2), **check the live site as a real user** (Part 3), and
**switch the learning features on for trainees** (Part 4). Do Part 1 first,
always: confirm it works locally before spending time on Part 2.

**What has and hasn't been tested.** The code has an automated test suite
(run it with `npm test`) and browser checks that run against a local test
database (`scripts/device-checks/`). The AI features were checked against a
stand-in for Claude, not the real one, and nothing was checked on a real
phone or against your live data. That is why Part 3 exists: the first time
you do it on your real site is the real test.

---

## Prerequisites

- **Node.js 18.18 or newer** (Next.js 14 requires this). Check with `node -v`.
- **Docker Desktop** (or any way to run PostgreSQL 16 with the pgvector extension) — only for Part 1.
- **A GitHub account**, a **Vercel** account and a **Neon** account — only for Part 2.
- **A code editor** and basic command-line comfort.

One key is required for the platform to be genuinely usable:

| Service | Used for | Get a key at |
|---|---|---|
| Anthropic | Loop (the assistant), the guide bot, structuring uploaded Word questions, generating and validating bank questions, writing game items, AI feedback after assessments | https://console.anthropic.com |

The rest are optional. The platform works without each of them, with just that one feature quietly switched off:

| Service | Used for | If you skip it |
|---|---|---|
| Resend (https://resend.com) | Welcome, password-reset, module-unlock and certificate emails, and other notices | Actions still complete; the email step is skipped with a logged warning. **A live cohort needs this.** |
| Paystack (https://paystack.com) | Paid course enrolment | Paid enrolment doesn't work. Free courses are unaffected |
| Voyage AI (https://dashboard.voyageai.com) | Flagging likely-duplicate questions | Duplicate detection is skipped |
| Vercel Blob (in the Vercel dashboard) | File uploads: profile pictures, logos, resumes, course flyers, job and curriculum files | Uploads fail; everything else works |
| Google Cloud Translation | Drafting Yoruba, Igbo, Hausa and French translations | Those four drafts fail; Pidgin uses Anthropic instead |
| Google sign-in | "Sign in with Google" for trainees | The buttons show an error |
| Web push keys | Notifications on phones and computers | Push stays switched off; in-app notifications still work |

---

## Part 1 — Run it locally

### 1. Get the code

```bash
git clone <your repository URL>
cd <the folder that contains package.json>
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

- `AUTH_SECRET` — generate one with `openssl rand -base64 32` and paste it in.
- `ANTHROPIC_API_KEY` — from console.anthropic.com.

`DATABASE_URL` is already set to match the Docker database you start next. The
optional keys can stay blank for local testing.

### 4. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 with the pgvector extension (the image is
`pgvector/pgvector:pg16`; plain Postgres will not work). Confirm it is running
with `docker ps`.

### 5. Generate the Prisma Client

```bash
npx prisma generate
```

### 6. Create the database tables

```bash
npx prisma migrate deploy
```

This applies every migration in `prisma/migrations/`, in order, which is exactly
what production does. **Use this, not `prisma db push`:** `db push` skips the
migration history (and the data steps inside some migrations), and a database
made that way can't be updated cleanly later.

### 7. Seed demo data (local only)

```bash
npm run db:seed
```

Creates a demo Super Admin, a demo exam with sample questions, and a demo course with a module and assessment. Optional extras:
`npm run db:seed-demo` adds a demo ecosystem (organisations, posts, videos) so
the public pages have something on them. Demo rows are never shown on a
production deployment.

### 8. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**.

### Demo logins

- **Staff:** `admin@aaicbi.africa` / `ChangeMe123!` (a Super Admin). Staff sign in at **`/internal-access/staff-sign-in`** (no public page links to it; you can change the address, see `STAFF_SIGN_IN_PATH`). The older `/admin/login` still works.
- **Demo by-code exam:** `AAICBI-EXCEL-DEMO` at `/exam/enter`.
- Trainees register themselves at `/trainee/register`.

### A real first test, not just "does it load"

1. Register a trainee, enrol in a course, complete a lesson, and take the module assessment. The next module should unlock only after passing.
2. Finish every module. A certificate should appear, with a public link at `/certificate/[code]`.
3. Sign in as staff and check **Certificates Issued** and **Cohorts** for that course.
4. Open the **Command Center** and ask Loop a simple question. If it answers, the Anthropic key works.
5. If you set `RESEND_API_KEY`, check that registration and password-reset emails arrive.

### Run the checks

```bash
npm test          # the automated tests
npx tsc --noEmit  # the type check
```

### Local troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `prisma generate` fails with a network error | Firewall, proxy, or no internet | Check connectivity; it downloads a query engine |
| `docker compose up -d` fails | Docker Desktop isn't running | Start Docker Desktop first |
| Port 5432 already in use | Another Postgres is already running | Stop it, or change the port in `docker-compose.yml` and `DATABASE_URL` together |
| Port 3000 already in use | Another dev server is running | `npm run dev -- -p 3001`, or stop the other process |
| `migrate deploy` fails with `extension "vector" is not available` | The database isn't the pgvector image | `docker compose down && docker compose up -d` to pick up the right image, then run it again |
| Emails never arrive | `RESEND_API_KEY` not set | Expected: emails are skipped without it |
| Loop, DOCX import or AI features do nothing or error | `ANTHROPIC_API_KEY` missing or invalid | It is required for those features |
| "Draft" buttons on `/admin/translations` fail for Yoruba/Igbo/Hausa/French | `GOOGLE_TRANSLATE_API_KEY` missing or invalid | Only needed for those four languages |
| File uploads fail | Vercel Blob not set up | See the Blob notes in `.env.example` |
| Paystack webhook returns 401 for a genuine event | `PAYSTACK_SECRET_KEY` missing or wrong, or test and live keys mixed | Use the key from the same mode (test or live) as the webhook URL registered in Paystack |
| "Sign in with Google" returns to an error | Client id or secret missing, or the redirect address isn't registered | Register `{APP_URL}/api/auth/google/callback` exactly, including `http` or `https` |

---

## Part 2 — Put it live

The recommended path is **Vercel** (hosting) + **Neon** (managed Postgres).
Confirm Part 1 works before starting.

### 1. Push the code to GitHub

If it isn't there already, create an empty repository on GitHub and push this
project to it. From now on, **merging a pull request into `main` is how a change
goes live.**

### 2. Create a production database (Neon)

1. Sign up at https://neon.tech and create a project.
2. Copy the connection string. It looks like `postgresql://user:password@host/dbname?sslmode=require`.
3. Neon supports the two Postgres extensions this app needs (`vector` and `pg_trgm`); the migrations create them for you.
4. Keep the connection string private. Never paste it into a chat, a commit or a screenshot.

### 3. Import the project into Vercel

1. Sign up at https://vercel.com (you can sign in with GitHub).
2. **Add New → Project**, and select the repository.
3. Leave the build settings on their defaults. The project's own build command (`vercel-build`) is used automatically.

### 4. Set environment variables in Vercel

Open **Settings → Environment Variables** and add these for the **Production**
environment, **before the first deploy**:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | The Neon connection string from step 2 |
| `AUTH_SECRET` | A **new** random value, not your local one: `openssl rand -base64 32` |
| `APP_URL` | Your real address, e.g. `https://your-domain.org`. **Do not leave it blank**: it is what emails and share links point to |
| `ANTHROPIC_API_KEY` | Your Anthropic key (a separate production key helps you track usage) |
| `RESEND_API_KEY` | Set this for real. A live cohort needs working email |
| `EMAIL_FROM` | After verifying a sending domain in Resend, e.g. `AAICBI <noreply@your-domain.org>` (see the note below) |
| `CRON_SECRET` | Generate one: `openssl rand -base64 32`. Without it the scheduled jobs below don't run |
| `PAYSTACK_SECRET_KEY` | Your **live** secret key (Paystack: Settings → API Keys & Webhooks). Also register the live webhook URL there |
| `NEXT_PUBLIC_PAYSTACK_KEY` | Your Paystack **public** key for the same mode (needed for paid checkout) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | For push notifications. Generate once with `npx web-push generate-vapid-keys`; `VAPID_SUBJECT` is `mailto:you@your-domain.org`. Skip all three to leave push off |
| `STAFF_SIGN_IN_PATH` | Optional. Your own hidden staff sign-in address (lowercase letters, digits, `-`, `_`, `/`). It is read at build time, so redeploy after changing it |
| `STAFF_LEGACY_LOGIN` | Optional. Set to `off` when you are ready to make the older `/admin/login` answer 404 |
| `BLOB_READ_WRITE_TOKEN` | Added automatically once you create Blob storage on the project (Storage tab → Create → Blob) |
| `VOYAGE_API_KEY` | Optional |
| `GOOGLE_TRANSLATE_API_KEY` | Optional |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional. Register `{APP_URL}/api/auth/google/callback` as an Authorized redirect URI for the production address |
| `LOOP_MODEL`, `GUIDE_CONSULTANT_MODEL` | Optional. Which Claude model Loop and the consultant use. Both default to `claude-sonnet-4-5` |
| `BANK_GENERATOR_MODEL`, `BANK_REVIEWER_MODEL` | Optional. The question bank uses one Claude model to **write** questions and a **different** one to **review** them. Defaults: `claude-sonnet-5-5` writes, `claude-opus-5-5` reviews. Set either to a model your Anthropic account can use. If a model isn't available to your key, writing or reviewing stops with a message naming the setting |
| `CHANGE_REQUEST_GITHUB_REPO`, `CHANGE_REQUEST_GITHUB_TOKEN` | Optional. When both are set, approving a change request also opens a GitHub issue (`owner/repo`, and a token allowed to create issues there). See `docs/change-requests.md` |
| `WHATSAPP_ENABLED` | Leave `false`. WhatsApp isn't implemented |
| `MAX_UPLOAD_BYTES` | Optional. Word-file upload limit; defaults to 10 MB |

`VERCEL_ENV` and `NODE_ENV` are set by Vercel itself; don't add them.

> **On `EMAIL_FROM`:** until you verify a real sending domain in Resend,
> emails fall back to Resend's shared test sender. It works, but looks like a
> test account to real people. Do this before onboarding a real cohort.

> **Previews and your database.** Preview deployments (one per pull request)
> never change the database, but they use whatever `DATABASE_URL` you give the
> Preview environment. If you point it at the production database, a preview of
> newer code can run against an older schema. Safer: give previews their own
> Neon branch or database.

### 5. Deploy

Click **Deploy**. For a production deployment the build does this, in order:

1. Generates the Prisma client.
2. **Applies any pending database migrations** (`prisma migrate deploy`). It uses Neon's direct host automatically, because pooled connections can't hold the migration lock. If a migration fails, **the build fails and the previous version keeps serving**, so new code never goes live against a database missing its tables.
3. Builds the app.

You do **not** need to run `prisma db push` or any migration by hand. Optional
settings: `MIGRATE_DATABASE_URL` (use a different connection for migrations) and
`SKIP_DB_MIGRATE=1` (build without migrating; an escape hatch, not a habit).

After the first deploy, open the deployment's build log and confirm you see
"Apply database migrations" finish without errors.

### 6. Create your first real Super Admin

**Do not run `npm run db:seed` against production.** It creates a known demo
account with a published password. Instead, create your own account once:

1. On your own machine, make a password hash (the password appears in your shell history, so use a throwaway terminal and a strong password):

   ```bash
   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'your-strong-password'
   ```

2. Point Prisma Studio at production for this one task:

   ```bash
   DATABASE_URL="your-production-connection-string" npx prisma studio
   ```

3. In the **User** table add a row: your name, your email, the hash as `passwordHash`, and role `SUPER_ADMIN`. Save, then close Studio.
4. Sign in at your staff sign-in address (default `/internal-access/staff-sign-in`) and change your password if the app offers it.

Further staff are created from the admin pages (a Super Admin adds them, or
approves a training organisation), never by a public form.

### 7. Scheduled jobs

`vercel.json` schedules three jobs. They run only when `CRON_SECRET` is set:

| Job | When (UTC) | What it does |
|---|---|---|
| `course-access-sweep` | Daily 06:00 | Expires course access and sends reminder emails |
| `analytics-alerts` | Daily 07:00 | Checks the platform for alerts |
| `analytics-report` | Mondays 08:00 | Builds the weekly report |

### 8. Custom domain

Add it under **Settings → Domains**, then set `APP_URL` to match and redeploy.
Re-check anything tied to the address: the Paystack webhook URL, the Google
sign-in redirect address, and your Resend sending domain.

### 9. Public switches

As Super Admin open **Platform → Ecosystem** to choose which public parts are
visible (the home feed, organisation pages, videos, public jobs, the trainee
directory, landing-page sections). They start on; switching one off hides it at
once and deletes nothing. See `docs/public-ecosystem.md`.

---

## Part 3 — Check the live site as a real user

Do this once on your **live address**, not just "does the homepage load":

1. Sign in as Super Admin. Open the **Command Center** and ask Loop something simple. If it answers, the Anthropic key works in production.
2. Register a test trainee. Check the welcome email arrives and the link inside it points to your real address.
3. Enrol in a free course, finish a lesson, take the assessment, and open the certificate link.
4. Make a small payment in **test** mode first, then confirm one in live mode when you are ready. Check the course unlocks.
5. Open the site on a real phone. Try signing in, a lesson, and (if push is set) switching on alerts. On iPhone, the app must be added to the home screen first.
6. In Vercel, open **Logs** and look for repeated errors after your test.

---

## Part 4 — Switch the learning features on for trainees

Nothing here is visible to trainees until you switch it on per module. For your
pilot module, in this order:

1. **Learning objectives.** Confirm them (Loop can draft them from the module's materials).
2. **Question bank.** Open the module in the **Game Studio**; the **Question bank** panel is beside the Loop chat. Press **Get the practice questions ready**. One Claude model writes the questions and a different one reviews each of them against the lesson material, automatically, before you see them. Then you only approve: **Approve all that passed**, and decide on any it flagged (approve anyway, edit, or reject). Approving puts the questions live and splits them into the practice and formal pools for you. You can do the same by chatting with Loop. The module needs lesson materials Loop can read (Word, PDF or PowerPoint).
3. **Pools.** Each objective needs 10 approved practice and 6 approved formal questions before practice can go live. The panel works out how many more each objective needs and splits approved questions between the pools when you approve.
4. **Practice and games.** In the **Game Studio**, switch practice on and assign games live. Play it yourself as a trainee before anyone else does.
5. **Staff.** In the studio's team panel, choose each person's Loop level and which tools they may use. Platform-wide tools are off by default. See `docs/game-studio.md`.
6. Start with a **small group**, then widen.

---

## Updating the live site later

- A change goes live when its pull request is **merged into `main`**. Vercel then builds, applies any new migrations, and switches over only if the build succeeds.
- Changes that need a new migration say so in their pull request. Check the production build log afterwards.
- **Rolling back:** Vercel can switch back to the previous deployment instantly, but that does **not** undo database migrations. Migrations here add tables and columns, so the older code normally still works; check the pull request's own rollback note before relying on it.
- Back up the production database (Neon's backup and point-in-time restore) before a large change.

---

## Environment variable reference

`.env.example` in the project has the full explanation of each one. This table
is a quick summary.

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Signs session tokens |
| `APP_URL` | Yes in production | Absolute base address for links in emails and shares |
| `ANTHROPIC_API_KEY` | Yes | Loop, guide bot, question generation and validation, game items, Word import, AI feedback |
| `RESEND_API_KEY` | Effectively, for a real cohort | All notification emails |
| `EMAIL_FROM` | No | Sender address for emails |
| `CRON_SECRET` | Yes, for the scheduled jobs | Secures the scheduled jobs |
| `PAYSTACK_SECRET_KEY` | For paid courses | Verifies Paystack webhooks and payments |
| `NEXT_PUBLIC_PAYSTACK_KEY` | For paid courses | Paystack public key for checkout |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | No | Web push notifications |
| `BLOB_READ_WRITE_TOKEN` | For uploads | File storage (added by Vercel Blob) |
| `STAFF_SIGN_IN_PATH` | No | Address of the staff sign-in page |
| `STAFF_LEGACY_LOGIN` | No | `off` disables the older `/admin/login` |
| `LOOP_MODEL`, `GUIDE_CONSULTANT_MODEL` | No | Claude model for Loop and the consultant |
| `BANK_GENERATOR_MODEL`, `BANK_REVIEWER_MODEL` | No | Claude model that writes bank questions, and a different one that reviews them |
| `CHANGE_REQUEST_GITHUB_REPO`, `CHANGE_REQUEST_GITHUB_TOKEN` | No | Open a GitHub issue when a change request is approved |
| `VOYAGE_API_KEY` | No | Duplicate-question detection |
| `GOOGLE_TRANSLATE_API_KEY` | No | Translation drafts |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | "Sign in with Google" for trainees |
| `MIGRATE_DATABASE_URL`, `SKIP_DB_MIGRATE` | No | Migration overrides (see Part 2, step 5) |
| `WHATSAPP_ENABLED` | No | Leave `false` |
| `MAX_UPLOAD_BYTES` | No | Word-file upload limit |

---

## If something doesn't match this guide

This guide describes the project as it is now. If a command here doesn't match
what you see, such as a missing script or a different file name, treat that as
something to investigate, not to work around quietly. It would mean the code and
this guide have drifted apart.

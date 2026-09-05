# AAICBI LMS — Deployment Guide

Two parts: **running this on your own machine** (for development and
testing), and **putting it live** on the internet for real trainees.
Do Part 1 first, always — confirm it actually works locally before
spending any time on Part 2.

**One thing to know before you start:** this project was built and
validated inside a sandboxed environment with restricted internet
access, which meant one specific step — `prisma generate` — could
never actually complete there. Everything else was checked repeatedly
(type-checking, 95 automated tests, real Postgres verification of every
schema change), but the app itself has never been run as a live server,
not once. On your own machine, with normal internet access, that step
should just work. This guide assumes a completely standard environment
— if `prisma generate` fails for you too, it's a different, new
problem, not the same one.

---

## Prerequisites

- **Node.js 18.18 or newer** (Next.js 14 requires this). Check with `node -v`.
- **Docker Desktop** (or any way to run PostgreSQL 16 locally) — only for Part 1.
- **A GitHub account** — only for Part 2.
- **A code editor** and basic command-line comfort.

Two API keys are required for the app to be genuinely usable (not just
running):

| Service | Used for | Get a key at |
|---|---|---|
| Anthropic | Structuring uploaded DOCX questions into a real question bank; AI performance feedback after assessments | https://console.anthropic.com |
| — | Everything else (courses, progress locking, certificates, auth) needs no external key | — |

Two more are optional — the app works without them, just with that one
feature quietly switched off:

| Service | Used for | Get a key at | If you skip it |
|---|---|---|---|
| Voyage AI | Flagging likely-duplicate questions on DOCX import | https://dashboard.voyageai.com | Duplicate detection is skipped; nothing else is affected |
| Resend | Welcome, password-reset, module-unlock, and certificate emails | https://resend.com | Every action that would send an email still completes normally — the email step just quietly no-ops with a logged warning |

---

## Part 1 — Run it locally

### 1. Get the code onto your machine

Extract the project zip, then open a terminal in the app folder — this
is the folder that actually contains `package.json`:

```bash
cd aaicbi-lms-project/scaffold-code/m9-foundation
```

Everything from here on runs from inside this folder.

### 2. Install dependencies

```bash
npm install
```

### 3. Set up your environment file

```bash
cp .env.example .env
```

Open `.env` and fill in at minimum:

- `AUTH_SECRET` — generate one with `openssl rand -base64 32` and paste the result in.
- `ANTHROPIC_API_KEY` — from console.anthropic.com.

Leave everything else at its default for now — `DATABASE_URL` is
already set to match the Docker database you're about to start, and
the optional keys (`VOYAGE_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`,
`APP_URL`) can genuinely stay blank for local testing.

### 4. Start the database

```bash
docker compose up -d
```

This starts a local PostgreSQL 16 instance matching what `DATABASE_URL`
in `.env.example` already expects — you shouldn't need to change
anything. Confirm it's running with `docker ps`; you should see a
container for `postgres:16-alpine`.

### 5. Generate the Prisma Client

```bash
npx prisma generate
```

This downloads Prisma's query-engine binary and generates the
TypeScript types the whole app is written against. **This is the step
that could never complete inside the sandbox this project was built
in** — on a normal machine with normal internet access, this should
just work in a few seconds. If it fails here, check your internet
connection and any corporate firewall/proxy before assuming something
deeper is wrong.

### 6. Create the database tables

```bash
npx prisma db push
```

This reads `prisma/schema.prisma` and creates every table, matching
exactly what's been verified against a real Postgres instance
throughout this project's build.

### 7. Seed demo data

```bash
npm run db:seed
```

Creates a demo staff account, a demo trainee account, a demo course
with a locked second module, and a by-code exam — enough to actually
click through a real flow immediately.

### 8. Start the app

```bash
npm run dev
```

Open **http://localhost:3000**.

### Demo logins

- **Staff:** `admin@aaicbi.africa` / `ChangeMe123!` → seeded as `SUPER_ADMIN`, so this account can see every course and exam across the whole org, not just its own — see `admin/login`.
- **Trainee:** `demo.trainee@example.com` / `TraineeDemo123!` → `trainee/login`
- **Demo by-code exam:** `AAICBI-EXCEL-DEMO` → `exam/enter`

### A real first test to run, not just "does it load"

1. Log in as the demo trainee, go to **Courses**, open the demo course.
2. Complete Module 1's lesson, then take its assessment — module 2 should unlock only after passing.
3. Complete every module in the course — a certificate should appear on the trainee dashboard automatically, with a public link at `/certificate/[code]`.
4. Log in as staff, open the same course, and check the **Certificates Issued** and **Cohorts** pages.
5. If you set `RESEND_API_KEY`, check that registration and password-reset emails actually arrive.

### Local troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| `prisma generate` fails with a network error | Firewall, proxy, or no internet | Check connectivity; this is the one step that couldn't be pre-validated |
| `docker compose up -d` fails | Docker Desktop isn't running | Start Docker Desktop first |
| Port 5432 already in use | Another Postgres instance is already running locally | Stop it, or change the port in `docker-compose.yml` and `DATABASE_URL` together |
| Port 3000 already in use | Another dev server is running | `npm run dev -- -p 3001`, or stop the other process |
| Emails never arrive | `RESEND_API_KEY` not set | Expected — this is the documented graceful no-op, not a bug. Set the key to enable real sending |
| DOCX import or AI feedback does nothing / errors | `ANTHROPIC_API_KEY` missing or invalid | Required for these two features specifically; everything else works without it |
| "Draft" buttons on `/admin/translations` fail for Yoruba/Igbo/Hausa/French | `GOOGLE_TRANSLATE_API_KEY` missing or invalid | Only needed for those four languages — Pidgin drafting uses `ANTHROPIC_API_KEY` instead |
| Profile picture upload fails | Vercel Blob storage not yet created on this project | Storage tab → Create → Blob — `BLOB_READ_WRITE_TOKEN` is added automatically once you do |
| Paystack webhook returns 401 for a genuine event | `PAYSTACK_SECRET_KEY` missing, wrong, or test/live key mismatched with the mode Paystack is actually sending from | Confirm the key matches the same mode (test vs. live) as the webhook URL registered in the Paystack dashboard |
| `prisma db push` fails with `extension "vector" is not available` | The Postgres image doesn't have pgvector installed | Fixed in this project's `docker-compose.yml` (uses `pgvector/pgvector:pg16`) — if you still hit this, run `docker compose down && docker compose up -d` to pick up the corrected image, then `npx prisma db push` again |

---

## Part 2 — Put it live

The recommended path is **Vercel** (hosting) + **Neon** (managed
Postgres) — both have real free tiers suitable for getting started, and
this is the path the project's own cost estimate (see `README.md`,
"Rough monthly cost estimate") is based on. Confirm Part 1 works before
starting this.

### 1. Push the code to GitHub

```bash
cd aaicbi-lms-project/scaffold-code/m9-foundation
git init
git add .
git commit -m "AAICBI LMS"
```

Create a new, empty repository on GitHub, then follow GitHub's own
instructions to push this existing local repository to it.

### 2. Create a production database (Neon)

1. Sign up at https://neon.tech and create a new project.
2. Copy the connection string it gives you — it looks like
   `postgresql://user:password@host/dbname?sslmode=require`.
3. Keep this open; you'll paste it into Vercel in step 4.

### 3. Import the project into Vercel

1. Sign up at https://vercel.com (you can sign in directly with your GitHub account).
2. Click **Add New → Project**, and select the GitHub repository you just pushed.
3. Vercel will detect this as a Next.js project automatically — leave the build settings on their defaults.

### 4. Set environment variables in Vercel

Before the first deploy, open the project's **Settings → Environment
Variables** and add every variable from your local `.env`, using
**production-appropriate values**, not your local ones:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | The Neon connection string from step 2 |
| `AUTH_SECRET` | Generate a **new** one — don't reuse your local dev secret: `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Same key as local, or a separate production key if you prefer to track usage separately |
| `VOYAGE_API_KEY` | Same as local, or blank |
| `RESEND_API_KEY` | Set this for real — a live cohort needs working email |
| `EMAIL_FROM` | Once you've verified a sending domain in Resend, e.g. `AAICBI <noreply@aaicbi.africa>` — see the note below |
| `APP_URL` | Your real deployed URL, e.g. `https://aaicbi-lms.vercel.app` or your custom domain — **do not leave this blank in production**, it's what notification emails link back to |
| `WHATSAPP_ENABLED` | `false` — leave this as-is, WhatsApp isn't implemented |
| `MAX_UPLOAD_BYTES` | `10485760` (10MB), or your own preferred limit |
| `GOOGLE_TRANSLATE_API_KEY` | From Google Cloud Console — required only for drafting Yoruba/Igbo/Hausa/French translations (M42); Pidgin drafting uses `ANTHROPIC_API_KEY` instead, since Google's API doesn't support Pidgin. Leave blank if you're not using this feature yet — everything else works without it. |
| `BLOB_READ_WRITE_TOKEN` | Auto-provided once you enable Vercel Blob storage on this project (Storage tab → Create → Blob) — you don't set this manually, but the feature (profile pictures, M44) won't work until that storage is actually created |
| `PAYSTACK_SECRET_KEY` | From your Paystack dashboard (Settings → API Keys & Webhooks) — use your TEST key while developing. Also register the webhook URL itself in that same dashboard page; test and live modes have separate webhook URLs, both need configuring |

> **On `EMAIL_FROM`:** until you verify a real sending domain in
> Resend's dashboard, emails fall back to Resend's shared test sender —
> functional, but it'll look like a test account to real trainees, not
> like it's genuinely from AAICBI. Worth doing properly before
> onboarding a real cohort; see Resend's own domain-verification docs.

### 5. Deploy

Click **Deploy** in Vercel. This runs `npm install` and `npm run build`
for you automatically.

### 6. Push the schema to your production database

The build step does **not** create your database tables — do this once,
from your own machine, pointed at the production database:

```bash
DATABASE_URL="your-neon-connection-string" npx prisma db push
```

(Or set `DATABASE_URL` in your local `.env` temporarily to the Neon
string, run `npx prisma db push`, then change it back.)

### 7. Seed a real admin account

**Do not run `npm run db:seed` against production as-is** — it creates
the exact same demo accounts and password (`ChangeMe123!`) documented
in this file, publicly, forever, unless you change it. Either:

- Edit `prisma/seed.ts` to use a real name, email, and a strong password before running it against production, or
- Skip seeding entirely and create the first `SUPER_ADMIN` account directly via Prisma Studio (`npx prisma studio`, pointed at the production `DATABASE_URL`) or a one-off script.

### 8. Verify the live deployment

Repeat the same real first test from Part 1 (register, take a module,
earn a certificate) against your live URL — not just checking that the
homepage loads.

### Custom domain (optional)

Add it under Vercel's **Settings → Domains**, then update `APP_URL` in
your environment variables to match, and redeploy.

---

## Environment variable reference

The authoritative copy of this lives in `.env.example` in the project
itself, with the full reasoning behind each one — this table is a
quick-reference summary, not a replacement for reading that file.

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Signs trainee/staff session tokens |
| `ANTHROPIC_API_KEY` | Yes | DOCX question extraction, AI performance feedback |
| `VOYAGE_API_KEY` | No | Duplicate-question detection on import |
| `RESEND_API_KEY` | No (but effectively required for a real cohort) | All notification emails |
| `EMAIL_FROM` | No | Sender address for emails |
| `APP_URL` | No (**required** in production) | Absolute base URL for links inside emails |
| `WHATSAPP_ENABLED` | No | Leave `false` — not implemented |
| `MAX_UPLOAD_BYTES` | No | DOCX upload size limit |

---

## What to do if something doesn't match this guide

This guide describes the app exactly as it exists in the project files
right now. If a command in here doesn't match what you actually see —
a missing script, a different file name — that's worth flagging and
investigating specifically, not working around silently, since it
would mean something drifted between what was built and what's
documented.

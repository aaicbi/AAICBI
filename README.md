# AAICBI Learning Management System

A full-featured LMS built for Africa's AI Capacity Building Initiative:
courses with progress-locked modules, AI-graded assessments, real
payments, publicly verifiable certificates, an employer portal for
discovering and hiring trainees, and a course review/testimonial
system — built out from the original M9 foundation scaffold through
47 sequenced milestones across six stages, all now complete except one
external, non-technical dependency (see "What's genuinely not done"
below).

## Setup

> **For a complete, step-by-step guide covering both local development
> and live production deployment (Vercel + Neon), see
> [`DEPLOYMENT.md`](./DEPLOYMENT.md) in this same folder.** The quick
> version below is a fast reference for anyone already familiar with
> the stack; `DEPLOYMENT.md` is the one to follow if this is your
> first time running the project.

> If you obtained this project by extracting it from a `.skill` file
> rather than having Claude generate it fresh, some folder names under
> `src/app/` may still read as `__id__` or `__code__` instead of
> `[id]`/`[code]` (Next.js's real dynamic-route syntax) — a packaging
> limitation, not a typo. Run `python3 scripts/materialize_template.py .`
> from the skill directory once to fix that before continuing.

```bash
npm install
cp .env.example .env        # see that file's own comments for what each key is for and which are optional
docker compose up -d        # starts local Postgres
npx prisma generate         # requires internet access — downloads the query engine
npx prisma db push          # creates tables from prisma/schema.prisma
npm run db:seed             # demo staff, trainee, employer, course, and testimonial
npm run dev
```

Then open http://localhost:3000.

- **Staff login:** `admin@aaicbi.africa` / `ChangeMe123!` → `/admin/login`
- **Trainee login:** `demo.trainee@example.com` / `TraineeDemo123!` → `/trainee/login`
- **Employer login:** `demo.employer@example.com` / `EmployerDemo123!` → `/employer/login` (pre-approved — visit `/employer/discover` to see the demo trainee)
- **Demo exam code:** `AAICBI-EXCEL-DEMO`

Only `AUTH_SECRET` and `ANTHROPIC_API_KEY` are required to run the app
at all — every other key in `.env.example` (email, payments, WhatsApp,
Google Translate, avatar storage) has its own real fallback behavior
when left unset, documented directly in that file's own comments next
to each one. Nothing crashes because a key is missing; features that
depend on one degrade to "not available yet" instead.

> **Note on `prisma generate`:** it needs to reach `binaries.prisma.sh`
> to download the query engine binary. If you're running this inside a
> network-restricted sandbox (as this scaffold was built and tested in),
> that step will fail with a 403 — it works fine on a normal machine or
> CI runner with unrestricted internet. `tsc --noEmit` will show a
> cascade of `@prisma/client` "no exported member" errors in that case —
> that's this same cause, verified against the original unmodified
> template, not a bug in this project. See `references/porting-notes.md`
> in the skill for the verification.
>
> This same restriction means real schema validation (as opposed to the
> individual, seeded-Postgres checks used throughout this whole build)
> could never run from inside this sandbox — and the very first real
> `prisma generate`, run by someone with actual internet access, did
> catch something genuine: `Exam` had two fields both named `course` —
> a legacy free-text label predating the real `Course` relation, and
> that relation itself, added later without noticing the name was
> already taken. Confirmed no application code anywhere referenced the
> relation by that name before fixing it (it was defined but never
> actually used), and fixed by renaming the relation to `parentCourse`
> — the exact same naming-collision fix `courseModule` (vs the legacy
> `module` label) already applied earlier in the same model, just not
> consistently carried forward when this second relation was added.
> Also swept the entire schema afterward for any other duplicate field
> name across every model — this was the only one.

Run the parser tests any time with `npm test` — they don't need a
database or the Prisma client, so they're a fast sanity check after any
change to the DOCX import logic.

## Deploying

Works on Vercel out of the box for the Next.js app; point `DATABASE_URL`
at a managed Postgres (Neon, Supabase, Railway, RDS...) instead of the
local docker-compose one. Run `npx prisma migrate deploy` against the
production database as part of your deploy step.

`build` is deliberately `prisma generate && next build`, not just
`next build`. `@prisma/client`'s own `postinstall` usually regenerates
the client automatically, but Vercel's build cache can skip a fresh
`npm install` on a redeploy, silently leaving a stale, mismatched
client in place — a well-known real-world failure mode for Prisma
projects on Vercel, not a hypothetical one. Running `prisma generate`
explicitly as the first step of `build` guarantees a fresh client on
every single deploy, cache or no cache.

## What's included

**Trainee experience** — self-registration and login, structured
courses with progress-locked modules and lessons, AI-graded
assessments with instant feedback and per-attempt analysis, offline
material downloads (redirect-based for video, proxied for documents),
lesson-level Q&A with staff replies and likes, WhatsApp notifications
alongside email (code complete, pending Meta's own approval process —
see "What's genuinely not done" below), and publicly verifiable
certificates the moment a course is completed.

**Payments** — real Paystack integration: webhook verification,
payment initiation, subscription lifecycle handling, OTP-gated course
unlock, and a manual reconciliation fallback for when a webhook never
arrives.

**Staff/admin** — four-role auth (`SUPER_ADMIN`/`ADMIN`/`INSTRUCTOR`),
the full CBT exam engine (server-side timing, idempotent grading, no
answer leakage before submission), the DOCX-upload → AI-structure →
review → publish pipeline for building assessments, Q&A moderation
with automatic warning-to-suspension escalation, and a real in-app
notification center (not just email) mirrored across every account
type.

**Employer portal** — a fourth account type with real registration
verification fields (business registration number, phone, optional
website/LinkedIn), staff-gated approval, trainee discovery with
per-introduction disclosure choices (a trainee's contact information
is *never* shown until they genuinely accept a specific request), a
job board with AI-screened postings that still always require a real
staff decision, and automatic posting expiry.

**Reviews & testimonials** — a trainee can review a course only after
genuinely completing it (a real, non-revoked certificate), staff can
promote a real review to a public landing-page testimonial with one
click, and manual testimonial entry for anything that predates this
system.

**Public, unauthenticated pages** — a real landing page describing the
actual product, a certificate verification page
(`/certificate/[code]`) anyone can check without logging in, and a
trainee-generated public profile link (`/profile/[code]`) that only
works while the trainee has discoverability turned on.

## What's genuinely not done

- **M43 (WhatsApp notifications)**: the code is fully built and
  verified — real dual-channel dispatch, opt-in with OTP verification,
  message templates for every notification type — but sending is
  genuinely blocked on WhatsApp Business API approval from Meta, an
  external, non-technical process outside this codebase's control.
  Leave `WHATSAPP_ENABLED=false` until that approval exists; setting
  it to `true` without a real provider implementation will make
  notifications fail loudly rather than pretend to send something that
  doesn't exist.
- **Dark mode is the default theme**, applied app-wide before first
  paint by a small script in the root layout that reads a first-party
  `theme` cookie (dark unless the cookie explicitly says `light`). The
  settings toggle writes that cookie, so a choice persists across
  navigation and refresh everywhere — not just on pages that re-run
  the apply logic. One deliberate boundary: **existing accounts**
  created before this change still carry `darkMode: false` in the DB,
  so a logged-in user who never touched the toggle keeps light on
  authenticated pages (their stored preference wins on those pages by
  design — we don't silently flip a saved choice). New accounts
  default to dark. If you want dark to override for *everyone*
  including pre-existing users, run a one-line migration:
  `UPDATE "Trainee" SET "darkMode" = true;` (and the same for `"User"`
  and `"Employer"`) — intentionally left as an explicit opt-in rather
  than done automatically.
- **Real Paystack testing with live test-mode credentials** has never
  happened from inside this sandbox — the webhook signature
  verification, payment flow, and subscription logic are all built and
  unit-tested against Paystack's own documented payload shapes, but a
  genuine end-to-end run against Paystack's real test environment is
  still worth doing before this goes anywhere near production traffic.

## Security notes worth knowing before you extend this

- Never add a query that returns `Option.isCorrect` or
  `Question.explanation` to a route a trainee's browser can reach before
  submission. `serveableQuestion()` in `examEngine.ts` is the only
  sanctioned way to shape a question for the client.
- `startAttempt`/`recordAnswer` re-check `expiresAt` server-side on every
  write — the client-side timer is cosmetic.
- All three account types' passwords are bcrypt-hashed; never log or
  return `passwordHash`.
- Any new admin route must call `requireRole()` with an explicit role
  list, not a bare call.
- A material's URL is staff-provided, not trusted blindly for
  server-side fetches — see `src/lib/ssrfGuard.ts` for the real
  DNS-resolving check that closes this, and its own comment for
  exactly what it does and doesn't defend against.
- Contact information (a trainee's email/phone) is never fetched into
  an employer-facing query at all until a specific, genuine disclosure
  decision has been made — not just omitted at render time. See
  `src/app/api/employer/discover/route.ts` and the introduction/
  application routes for the pattern.
"# AAICBI" 

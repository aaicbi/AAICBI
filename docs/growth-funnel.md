# Ayakbi Arena growth funnel

A public link that lets anyone with a phone try a 5-question taster of a course with no account, then leads them to module 1 free and to payment after they pass it. Everything is off until the Super Admin switches it on.

## The journey

1. A newcomer opens `aaicbi.app/play/<course-link>` (shared on WhatsApp first). The page opens with one promise and a Start button. No signup, no install.
2. They answer 5 questions with instant feedback. The questions come from the approved **practice** questions of the course's module 1. The assessment pool is never served. The answer key is only returned after the answer is given.
3. A result screen shows a rank, an answer grid (no spoilers), the missed learning objective, a WhatsApp share button and a link to the course. A percentile is only shown once at least 30 people have finished.
4. Later phases: save a score with a WhatsApp number, free module 1 on enrolling, the paywall after the pass mark, async duels, scholarship seats, the campaign report and commission ledger.

## Switches (all off by default)

A course's link is live only when every layer allows it:

| Layer | Who sets it | Notes |
| --- | --- | --- |
| Platform master switch | Super Admin | Emergency kill. |
| AAICBI courses / Organization courses | Super Admin | Two separate switches. |
| One organization | Super Admin | Needs the agreement recorded. Also holds the commission percentage and the scholarship-seat switch (off by default). |
| One course | Super Admin | Needs the course to be ready. |

A course is **ready** when it is published, has a module 1 with an assessment, has at least 5 approved practice questions, and its instructor has approved all 5 taster questions. If an approved question is later removed from the bank, the course goes offline until the taster is approved again.

When a switch goes off, new starts get "this campaign has ended" and a link to the course. A play already under way may finish. Every change is written to `GrowthAudit` with who and when. The data lives in `GrowthSetting`, `GrowthCampaign`, `GrowthTasterQuestion`, `GrowthGuestPlay` and `GrowthAudit` (migration `20261122090000_growth_funnel`).

## Where things are

- Super Admin: `/admin/growth` (`src/components/growth/GrowthAdmin.tsx`, `/api/admin/growth`).
- Instructor approval: the "Free taster game" section on the course page (`GrowthTaster.tsx`, `/api/admin/courses/[id]/growth`). Anyone who manages the course can approve; nothing goes live without the Super Admin's switches.
- Public page: `/play/<slug>` (the existing `/play/<id>` page resolves a campaign slug first, then falls back to the signed-in feed game). API: `/api/public/growth/<slug>/play` and `/answer`, rate limited per IP.
- Rules without a database: `src/lib/growth/growthCore.ts` (tests in `tests/growthCore.test.ts`). Database layer: `src/lib/growth/growth.ts`.
- Device check: `scripts/device-checks/growth-funnel.cjs`.

## Settings to know

`APP_URL` must be `https://aaicbi.app` in production so shared links and the WhatsApp text use the right address.

# Ayakbi Arena growth funnel

A public link that lets anyone with a phone try a 5-question taster of a course with no account, then leads them to module 1 free and to payment after they pass it. Everything is off until the Super Admin switches it on.

## The journey

1. A newcomer opens `aaicbi.app/play/<course-link>` (shared on WhatsApp first). The page opens with one promise and a Start button. No signup, no install.
2. They answer 5 questions with instant feedback. The questions come from the approved **practice** questions of the course's module 1. The assessment pool is never served. The answer key is only returned after the answer is given.
3. A result screen shows a rank, an answer grid (no spoilers), the missed learning objective, a WhatsApp share button and a link to the course. A percentile is only shown once at least 30 people have finished.
4. **Save my score** asks for a WhatsApp number (or email) and a ticked consent box. The number is stored as +234. The lead keeps the consent text and time and a private opt-out link (`/growth/optout/<token>`) that stops all contact.
5. **Start Module 1, free** (`/play/<slug>/continue`). A signed-in trainee is linked to their play and enrolled as a *preview* with module 1 open. Anyone else is offered "Create my free account" or "I already have an account", and both return to the same page. A free course just enrolls them fully.
6. After the trainee finishes module 1 the course page shows "You finished Module 1. Pay to keep going." and the existing Paystack payment. Modules 2 and later show "Pay to Unlock". The Ayakbi Arena (matches, ladder, chat) needs paid access, so it stays closed until they pay.
7. Later phases: async duels and the shareable image card, scholarship seats in action, the campaign report and the commission ledger.

### Module 1 access and switching off

Module 1 comes from a `GrowthGrant` row (trainee + course), checked in `getModuleAccessLevel` and the course page API next to the course's own free-preview setting; the larger of the two applies. The grant is kept if the campaign is later switched off, so people who started keep module 1. New people cannot start. Paid trainees are never affected.

## Switches (all off by default)

A course's link is live only when every layer allows it:

| Layer | Who sets it | Notes |
| --- | --- | --- |
| Platform master switch | Super Admin | Emergency kill. |
| AAICBI courses / Organization courses | Super Admin | Two separate switches. |
| One organization | Super Admin | Needs the agreement recorded. Also holds the commission percentage and the scholarship-seat switch (off by default). |
| One course | Super Admin | Needs the course to be ready. |

A course is **ready** when it is published, has a module 1 with an assessment, has at least 5 approved practice questions, and its instructor has approved all 5 taster questions. If an approved question is later removed from the bank, the course goes offline until the taster is approved again.

When a switch goes off, new starts get "this campaign has ended" and a link to the course. A play already under way may finish. Every change is written to `GrowthAudit` with who and when. The data lives in `GrowthSetting`, `GrowthCampaign`, `GrowthTasterQuestion`, `GrowthGuestPlay` and `GrowthAudit` (migrations `20261122090000_growth_funnel` and `20261123090000_growth_leads_grants`, which adds `GrowthLead` and `GrowthGrant`).

## Where things are

- Super Admin: `/admin/growth` (`src/components/growth/GrowthAdmin.tsx`, `/api/admin/growth`).
- Instructor approval: the "Free taster game" section on the course page (`GrowthTaster.tsx`, `/api/admin/courses/[id]/growth`). Anyone who manages the course can approve; nothing goes live without the Super Admin's switches.
- Public page: `/play/<slug>` (the existing `/play/<id>` page resolves a campaign slug first, then falls back to the signed-in feed game). API: `/api/public/growth/<slug>/play` and `/answer`, rate limited per IP.
- Rules without a database: `src/lib/growth/growthCore.ts` (tests in `tests/growthCore.test.ts`). Database layer: `src/lib/growth/growth.ts`.
- Device checks: `scripts/device-checks/growth-funnel.cjs` (phase 1) and `growth-funnel-2.cjs` (saved scores, continuing, the pay card).

## Settings to know

`APP_URL` must be `https://aaicbi.app` in production so shared links and the WhatsApp text use the right address.

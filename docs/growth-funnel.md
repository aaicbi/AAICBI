# Ayakbi Arena growth funnel

A public link that lets anyone with a phone try a 5-question taster of a course with no account, then leads them to module 1 free and to payment after they pass it. Everything is off until the Super Admin switches it on.

## The journey

1. A newcomer opens `aaicbi.app/play/<course-link>` (shared on WhatsApp first). The page opens with one promise and a Start button. No signup, no install.
2. They answer 5 questions with instant feedback. The questions come from the approved **practice** questions of the course's module 1. The assessment pool is never served. The answer key is only returned after the answer is given.
3. A result screen shows a rank, an answer grid (no spoilers), the missed learning objective, a WhatsApp share button and a link to the course. A percentile is only shown once at least 30 people have finished.
4. **Save my score** asks for a WhatsApp number (or email) and a ticked consent box. The number is stored as +234. The lead keeps the consent text and time and a private opt-out link (`/growth/optout/<token>`) that stops all contact.
5. **Start Module 1, free** (`/play/<slug>/continue`). A signed-in trainee is linked to their play and enrolled as a *preview* with module 1 open. Anyone else is offered "Create my free account" or "I already have an account", and both return to the same page. A free course just enrolls them fully.
6. After the trainee finishes module 1 the course page shows "You finished Module 1. Pay to keep going." and the existing Paystack payment. Modules 2 and later show "Pay to Unlock". The Ayakbi Arena (matches, ladder, chat) needs paid access, so it stays closed until they pay.
7. **Challenge a friend (async duels).** On the result the newcomer can name their challenge (optional; letters, numbers, spaces, apostrophes, hyphens, underscores only, 20 characters) and gets a WhatsApp message, a result-card image and a link `/play/<slug>?duel=<code>`. The friend plays the *same five questions in the same order*, with no one needing to be online. The friend's result compares the two (higher score wins; on the same score the clearly faster run, 1 second or more, wins; otherwise a tie) and lists standings: the challenger and up to ten friends, best first. The challenger sees friends appear on their own result (refreshed every 20 seconds). A friend can challenge onward, which starts a board of their own.
8. **Result card.** `/api/public/growth/<slug>/card/<code>` returns a PNG: 1200x630 (also the link preview for challenge links, via Open Graph) or `?format=status` for a 1080x1920 WhatsApp Status. It shows the rank, score, answer grid (no spoilers), the course and organization, and the link. The code is public and exposes only what the player chose to share. "Share my result card" uses the phone's share sheet where it can share files, and otherwise opens the image.
9. **Squads.** On the result, "Play with a group? Start a squad" makes a squad with a name of 3 to 24 safe characters. The person who starts it is the captain. The squad's join link is `/play/<slug>?squad=<code>`; everyone who joins plays the **captain's five questions in the same order**, so squads compare fairly. A squad's score is the **total of its members' scores** (out of 5 for each member), shown with the average and the squad's place among the campaign's squads. There is a cap of 50 members, and one device can join the same squad 6 times an hour. The board lists the top ten members and refreshes every 20 seconds.
10. **Squad against squad.** "Challenge another squad" gives a link `/play/<slug>?rival=<code>`. Whoever opens it plays the challenger's five questions, then is asked to start a squad of their own, which is recorded as answering the first. Both squads then show each other's total, member count and who is ahead. A squad can have several rivals (the five most recent are shown).
11. Later phases: scholarship seats in action, the campaign report and the commission ledger.

### Module 1 access and switching off

Module 1 comes from a `GrowthGrant` row (trainee + course), checked in `getModuleAccessLevel` and the course page API next to the course's own free-preview setting; the larger of the two applies. The grant is kept if the campaign is later switched off, so people who started keep module 1. New people cannot start. Paid trainees are never affected.

## Follow-up messages

People who save their score (with the consent box ticked) can be messaged. It is a separate switch under **Growth > Follow-up messages** and is off until a Super Admin turns it on.

- **The four messages**, each sent at most once to a person: a **welcome** straight after saving; **reminder 1** a day later and **reminder 2** (the last) three days later, both only while they have not started Module 1; and a **finish Module 1** nudge two days after they started it, if they have not finished. At least 20 hours between messages. Nothing after 14 days.
- **It stops** for anyone who opted out (the stop link in every message, or replying STOP on WhatsApp) or who has paid. Nothing is sent between **21:00 and 07:00 in Nigeria** (editable), and not more than the daily limit (default 200).
- **How it sends**, chosen by the Super Admin:
  - **By hand** works today with nothing to set up. Each message waits in the outbox with a "Send on WhatsApp" button that opens the chat with the text filled in, then "Mark as sent".
  - **WhatsApp, automatic** uses Meta's WhatsApp Business Cloud API (`src/lib/notifications/whatsapp.ts`). Meta only lets a business start a chat with a message template it has approved, so every message is a template with five positional variables: {{1}} first name, {{2}} rank, {{3}} course, {{4}} link, {{5}} stop link. The screen shows the exact text to register with Meta for each message and the template name to use. Set on the server: `WHATSAPP_ENABLED=true`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, and optionally `WHATSAPP_TEMPLATE_LANG` (default `en`). Register `https://<app>/api/webhooks/whatsapp` as the webhook. **This has been tested against a stand-in for Meta's API, not against Meta itself.**
  - **Email** uses the existing sender (`RESEND_API_KEY`) for people who left an email.
- **The webhook** (`/api/webhooks/whatsapp`) answers Meta's one-time check, then accepts delivery receipts (sent, delivered, read, failed) and STOP replies. It only trusts a body whose `X-Hub-Signature-256` matches `WHATSAPP_APP_SECRET`.
- **The messages are editable** (each must include `{stop}`; placeholders `{name}`, `{rank}`, `{course}`, `{link}`, `{stop}`). The hourly job `/api/cron/growth-messages` (`CRON_SECRET`) queues and sends what has come due; a welcome is also tried the moment a score is saved. Failed messages can be retried or skipped from the outbox.
- Data: `GrowthMessage` (the outbox, unique per person and message) and a `config` field on the `MESSAGING` row of `GrowthSetting` (migration `20261126090000_growth_messaging`). Pure rules and tests: `messagingCore.ts`, `tests/growthMessaging.test.ts`. Device check: `scripts/device-checks/growth-funnel-5.cjs`.

## Switches (all off by default)

A course's link is live only when every layer allows it:

| Layer | Who sets it | Notes |
| --- | --- | --- |
| Platform master switch | Super Admin | Emergency kill. |
| AAICBI courses / Organization courses | Super Admin | Two separate switches. |
| One organization | Super Admin | Needs the agreement recorded. Also holds the commission percentage and the scholarship-seat switch (off by default). |
| One course | Super Admin | Needs the course to be ready. |

A course is **ready** when it is published, has a module 1 with an assessment, has at least 5 approved practice questions, and its instructor has approved all 5 taster questions. If an approved question is later removed from the bank, the course goes offline until the taster is approved again.

When a switch goes off, new starts get "this campaign has ended" and a link to the course. A play already under way may finish. Every change is written to `GrowthAudit` with who and when. The data lives in `GrowthSetting`, `GrowthCampaign`, `GrowthTasterQuestion`, `GrowthGuestPlay` and `GrowthAudit` (migrations `20261122090000_growth_funnel`, `20261123090000_growth_leads_grants` for `GrowthLead` and `GrowthGrant`, and `20261124090000_growth_duels` for nickname, share code, duel link and duration on `GrowthGuestPlay`, and `20261125090000_growth_squads` for `GrowthSquad` plus the squad and rival links on a play).

## Where things are

- Super Admin: `/admin/growth` (`src/components/growth/GrowthAdmin.tsx`, `/api/admin/growth`).
- Instructor approval: the "Free taster game" section on the course page (`GrowthTaster.tsx`, `/api/admin/courses/[id]/growth`). Anyone who manages the course can approve; nothing goes live without the Super Admin's switches.
- Public page: `/play/<slug>` (the existing `/play/<id>` page resolves a campaign slug first, then falls back to the signed-in feed game). API: `/api/public/growth/<slug>/play` and `/answer`, rate limited per IP.
- Rules without a database: `src/lib/growth/growthCore.ts` (tests in `tests/growthCore.test.ts`). Database layer: `src/lib/growth/growth.ts`.
- Device checks: `scripts/device-checks/growth-funnel.cjs` (phase 1) and `growth-funnel-2.cjs` (saved scores, continuing, the pay card) `growth-funnel-3.cjs` (duels and the result card) and `growth-funnel-4.cjs` (squads).

## Settings to know

`APP_URL` must be `https://aaicbi.app` in production so shared links and the WhatsApp text use the right address.

# Installable app (PWA) and device-aware layout

The platform is one web app. On a phone or tablet it can be installed to the home screen and, below the laptop breakpoint, switches to a touch-first layout. Same accounts, APIs, database and business logic everywhere; this is a presentation layer.

## What is in place

| Piece | Where |
|---|---|
| Web app manifest (name, icons incl. maskable, standalone, theme/background, shortcuts) | `src/app/manifest.ts`, icons in `public/icons/` |
| Launch route: `/app` sends each account to its own home; shortcuts use `/app?to=messages\|events\|notifications` | `src/app/app/page.tsx`, `src/lib/pwa/launch.ts` |
| Viewport, theme colors, iOS home-screen metadata | `src/app/layout.tsx` |
| Service worker + branded offline page | `public/sw.js`, `public/offline.html`, headers in `next.config.js` |
| Install card (second visit, once a month at most, never during exams; iPhone/iPad get Share → Add to Home Screen steps) | `src/components/pwa/InstallPrompt.tsx`, `src/lib/pwa/installCore.ts` |
| Offline/online notice with Retry | `src/components/pwa/NetworkStatus.tsx` |
| Phone bottom navigation, role-aware, with unread Alerts badge and a "More" sheet | `src/components/pwa/MobileBottomNav.tsx`, `src/lib/pwa/mobileNav.ts` |
| Bottom nav inside role areas (layouts) and on pages outside them (events, jobs, organizations, notifications) | `ShellContent.tsx`, `GlobalBottomNav.tsx`, `GET /api/pwa/shell` |
| "Optimized for a larger screen" note with Copy link / Share, on course builder, exam creation and import, assessments, question bank, analytics, certificate studio, staff, Command Center | `src/components/pwa/DesktopRecommended.tsx` |
| Tables become labelled cards below 640px (opt out with `data-table="scroll"`) | `ResponsiveTables.tsx`, `src/lib/pwa/tableCards.ts`, `globals.css` |
| Web push | see below |

## Device classes

- Phone (< 640px): bottom navigation, tables as cards, desktop-only notes on complex pages.
- Tablet (640–1023px): bottom navigation, tables stay tables, notes only on the most demanding pages (`below="lg"`).
- Desktop (≥ 1024px): sidebar, everything as before. The bottom bar never renders.

## What the service worker stores (and never stores)

It keeps only public app files: `/_next/static/*`, `/icons/*`, the logo and the offline page. Pages and every `/api/*` call always go to the network, so nothing personal (messages, results, profiles, admin data) is ever kept on the device, and signing out leaves nothing to clear. If a page cannot be reached it shows `offline.html`. Unsent text on the page is untouched because the page itself is not reloaded.

## Web push

Dormant until configured. Generate keys once and set them in the environment:

```
npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # public
VAPID_PRIVATE_KEY=...              # secret
VAPID_SUBJECT=mailto:you@example.org
```

People turn it on from **Notifications → Alerts on this device** (on iPhone/iPad the app must be added to the home screen first). A push is sent whenever an in-app notification is written (`src/lib/notifications/log.ts`, plus the trainee video and report notices), to the devices of exactly the account whose bell shows it. The push carries a short title/line and a site path only; message notifications say only that something arrived. Dead subscriptions are removed automatically. Migration: `20261013090000_push_subscriptions`.

## Not covered yet (needs product decisions or new features)

- Investors have no in-app messaging: nothing in the data model gives an investor and a trainee or organization an agreed relationship to base it on (watching a pitch is not consent to be contacted), so there is no Messages tab for them. Organization-to-employer and employer-to-employer chat are also not offered, for the same reason.
- Dashboards keep one layout at all sizes; a phone-specific "priority order" home is the next step.
- Forms are the existing responsive forms; multi-step phone forms and numeric/email keyboards per field are not done everywhere.
- Offline drafts exist only for what a page already keeps in memory; there is no draft store for messages.
- Real-device testing (Android/iPhone/iPad, rotation, slow network) must be done by people on those devices.

## Messaging

One messaging system for everyone (`src/lib/messaging.ts`, `src/app/api/conversations/*`). Who may start a chat:

| From | May message |
|---|---|
| Trainee | cohort-mates, staff who teach them, any Super Admin, and employers they have engaged with (accepted introduction or applied to their job) |
| Employer | trainees who accepted their introduction or applied to one of their jobs, and any Super Admin (support) |
| Organization | trainees in its own cohorts (and each cohort's group chat); never other organizations |
| Super Admin | everyone, with read-only oversight of all conversations |

The employer rules are one table in `src/lib/messaging/policy.ts` with tests. A trainee who has not engaged with an employer cannot be messaged just for appearing in discovery. Blocking and reporting work for every kind of person.

Each new direct message creates (or refreshes) one unread notification for the other person, in their own bell (organizations in the organization's bell), plus a web push when enabled. It says who wrote, never what. Cohort group chats do not notify. The inbox (`ConversationList`) has search, unread first, last-message time and a refresh on return or reconnect; an unsent message is kept as a draft for the tab, and a send that fails offline keeps its text.

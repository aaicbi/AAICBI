# The ecosystem feed as the home page (phase 2)

## What changed
- **`/` is the ecosystem feed.** Visitors see it without an account, with a short introduction to AAICBI, search at the top, and clear "Log in" and "Create account" buttons. `/feed` shows the same feed so existing links keep working.
- **Rollback.** If a super admin switches the feed (or organization pages) off in the ecosystem settings, `/` shows the earlier landing page again (`src/components/landing/LegacyHome.tsx`) and `/feed` goes dark. The same fallback applies if the database cannot be read: the switches read as "off".
- **New header** (`src/components/ecosystem/HomeHeader.tsx`) on the home page and on the public pages: organizations, trainees, jobs (and a job), startups, learn, events, search, and the new `/login` and `/join`. It has the logo, a search field that is always visible (on phones too), Feed, Organizations, Trainees, Jobs, Startups, Learn, Events and "Verify a certificate", and a menu on phones with an install-app button. It never mentions staff sign-in.
- **Signed-in people** get a "Dashboard" button in the header, "Go to my dashboard" on the feed, and an account menu (dashboard, profile, write a post, my posts, saved, notifications, sign out). The dashboard address is worked out on the server from the session (`src/lib/auth/home.ts`): trainee and founder, employer, investor, instructor, training organization (`/admin/organization`), staff and super admin (`/admin/dashboard`).
- **`/login`** is one place to start signing in: the four kinds of account, each to its own sign-in page, carrying a local `?next=` (anything that leaves the site is dropped). **`/join`** is the existing four-card chooser; phase 3 replaces it with the five explained account types.
- **Everyone registered can post.** Checked for trainee, employer, investor, training organization, staff and super admin. A training organization's own login now posts as the organization when the client sends no identity (before, the default identity "self" did not exist for it).
- **Caching.** Visitors get a shared copy of the first page of the feed, trending topics and suggestions, refreshed every minute (topics and suggestions every five). Approving, blocking, unblocking, withdrawing, deleting or deciding an appeal on a post clears the feed copy at once. Signed-in people never use the shared copy.

## Why the header asks who is signed in
Public pages such as `/organizations` are shared and cacheable, so they cannot know who is looking. The header starts as the visitor view and `/api/session/summary` corrects it right after load (name, picture, public address, dashboard link, nothing else, never cached). The feed knows the viewer on the server, so it does not flicker.

## Not in this phase
Five account-type cards and the founder-with-startup sign-up (phase 3); search for employers, investors, startups and jobs, filters and suggestions as you type (phase 4); discovery panels around the feed (done in phase 5, below). The header search currently covers what `/search` covers: people, posts, organizations, videos, programs and events.

## Checks
`tests/ecosystemHome.test.ts`, `tests/pwa.test.ts` (Feed is the current place on `/`), `tests/staffLoginExposure.test.ts`, and `scripts/device-checks/home-feed.cjs` (39 real-database checks: the home page for a visitor, no staff link, search and account buttons, `/feed`, the account summary for six kinds of account, every kind posting, a pending post staying private, an approved post on the home page straight away, the feed switch and its fallback, `/login` and `/join`, and the shared header on seven public pages).

## Deploy and roll back
No database change. Deploy as usual. Roll back by switching the feed off in the ecosystem settings (instant), or by redeploying the previous version.

## Follow-up: gradient, triangle logo, About page
- **Card gradient.** The mint-into-gold surface (the intro panel's gradient) is now `bg-card-gradient` in `tailwind.config.ts`, built from the theme tokens, so light mode is soft mint into cream. Dark mode keeps cards flat: `--card-gradient-from` and `--card-gradient-to` are both the surface colour there (change them in `globals.css` to bring a dark gradient back). It is the default for `Card` and is used on post cards, the compose box, the feed's side panels, the join and login cards, the landing sections, dashboards and admin panels. Inputs, menus, dialogs and pills keep plain surfaces so text and controls stay clear. The two other card variants (highlighted, celebratory) are unchanged.
- **Triangle logo.** The logo is now the equilateral-triangle lockup everywhere it appears (header 48 to 56 px tall, sidebars 64 px). `Logo` takes `layout="beside"` for the rare place with no height to spare.
- **About page.** The earlier landing page is now `/about` (cached five minutes), with the new header and an "About" link in the header and on the feed's welcome panel. It is still what `/` shows if the feed is switched off.

## Phase 5: discovery panels around the feed
- **What shows.** In the feed's right column (desktop) and in a collapsible "Explore AAICBI" section under the compose box (phones): training organizations (featured ones first, three shown), career opportunities (open jobs from approved employers, with "closes in"), startup showcase (approved startups only), upcoming events, and, for visitors only, "How AAICBI works" with a create-account button. Each panel links to its full page (`/organizations`, `/jobs`, `/startups`, `/events`).
- **Real content only.** A panel with nothing to show is left out; examples and placeholders are never used here. Drafts, pending, rejected and suspended startups, unapproved or expired jobs, and anything behind a switched-off ecosystem switch (organization pages, public jobs) never appear. The data comes from the same loaders as the About page, so the privacy rules are shared.
- **Caching.** One copy shared by everyone, refreshed every five minutes (`src/lib/ecosystem/discovery.ts`, tags `landing` and `discovery`). A super admin approving, suspending, reinstating or verifying a startup refreshes it at once (`discoveryChanged()`). If the panels cannot be loaded they are left out and the feed still works.
- **Where the old landing content went.** The longer explanations, illustrations and sections remain on `/about`; the feed keeps only the short version.
- **Checks.** `tests/discoveryPanels.test.ts` and `scripts/device-checks/discovery.cjs` (real database: pending, draft and suspended startups hidden, an approved one shown at once, no placeholders, jobs panel only when jobs are open, visitor versus signed-in view, `/feed` has them too).

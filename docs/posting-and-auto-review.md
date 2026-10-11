# Posting, Auto-review, showcase in the feed

## Who can post, and where the button is
Every kind of signed-in account can post: trainees and founders, employers, investors, instructors, staff, super admins and training organizations (as the organization). Employers, investors and organizations can post once the AAICBI team has approved them; until then the compose page says so.

The way in is on every account's own menu (**Feed**, **Write a post**, **My posts**), in the feed header (**Post**, desktop), and as a **Post** button in the middle of the phone bottom bar. Events moved into "More" on phones to make room.

## Auto-review (`src/lib/posts/autoReview.ts`)
Every post is read by an automatic reviewer when it is sent. It adds up warning signs: abusive language, scam phrases, adult words, many links or shortened links, shared emails and phone numbers, shouting, repeated words, hashtag or mention stuffing, and a copy of the author's own recent post.
- **Few signs: published at once.** The post's history says "Published by Auto-review", so a person can still take it down.
- **Enough signs: sent to the human review inbox** with the reasons written in the history. Auto-review never rejects; only people do.
- **Trusted authors** (at least 3 published posts, nothing rejected or taken down in 180 days, no open reports) publish instantly unless the post shows serious signs (abuse, scam, adult content, link spam).
- A super admin's own posts are always published directly. A published post whose wording is edited is read again.
- Switch it off with `POST_AUTO_REVIEW=off`: then every post except a super admin's goes to a person.
- If the reviewer itself fails, the post goes to a person.

## Showcase in the feed (`src/lib/posts/showcaseSync.ts`)
A Community Showcase project that is listed and approved is also a published post by its trainee (one post per project, `Post.legacyProjectId`). A project put forward for the showcase is read by Auto-review: a clean one is approved at once, anything else waits in the showcase queue. Unlisting or removing a project takes its post down; listing it again brings it back. The feed refreshes the copies at most once a minute, and the showcase decision and project edits trigger it straight away. Earlier education videos were already copied into the feed.

## Phones
- **Loop** (the guide) can be dragged anywhere on screen (or moved with Alt and the arrow keys); the spot is remembered. Open the chat and choose "Put Loop back" to return it. Its chat window can no longer grow taller than the space above the cookie banner and bottom bar.
- **Long text** in notifications, post bodies and comments shows the first lines with "See more" / "See less" (`src/components/ui/Clamp.tsx`); words and web addresses always wrap. `Card` wraps text too.

## Checks
`tests/autoReview.test.ts`, `tests/postingReach.test.ts`, and the real-database scripts `scripts/device-checks/auto-review.cjs` (15), `posting-reach.cjs` (10) and `loop-drag-clamp.cjs` (9).

## Deploy
One additive migration (`20261026090000_post_showcase_link`: a nullable `legacyProjectId` on `Post`).

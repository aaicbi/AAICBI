# Feed, interactions and search (social core, step 5)

## Who can do what
| | Visitor | Signed in |
|---|---|---|
| Read feed, posts, tag pages, search | yes | yes |
| Follower / following **counts** | yes | yes |
| Follower **lists** | no (401) | yes |
| React, comment, follow, save, report, post | asked to create an account (401, modal, returns to the page) | yes |

Only posts that pass `publicPostWhere` appear: published, not blocked by the author's organization, and public (or signed-in-only for signed-in readers). A suspended or blocked post disappears from the feed, tag pages and search at once.

## Interactions
- **Reactions**: Like, Dislike, Insightful, Celebrate (Like and Dislike are one tap each; Insightful and Celebrate are under the sparkle button). One per profile per post; choosing another replaces it; choosing none removes it.
- **Comments**: up to 1000 characters, at most 2 links, one level of replies (a reply to a reply attaches to the top comment). The post's author or side, the comment's author and reviewers can remove a comment.
- **Follow**: profile to profile (people, organizations, startups). Cannot follow yourself; following twice is one follow; private profiles cannot be followed (hidden = missing). Organization follows made the older way are mirrored.
- **Saved**: private bookmarks, listed at `/saved`.
- **Reports**: a reason (spam, abuse, misleading, privacy, other) plus optional details. They arrive in the review inbox as REPORT cards; a reviewer dismisses (reason required), acts, or escalates to the super admin.
- **Rate limits** per hour: comments 20, reactions 240, follows 100, reports 20, bookmarks 200.
- Post text is turned into links (topics, @mentions, web addresses) without ever inserting raw HTML.

## Feed
- `/feed` has three columns on desktop (your space, feed, suggestions + trending topics). On phones it is one column, the composer is a floating button, and **Feed** is a main bottom-nav tab for every account.
- **Alerts moved into "More"**: the sheet lists Alerts first, and the More button carries the unread count.
- Tabs: Latest, Following (signed in), Discover (the earlier education videos and organization highlights).
- Paging is by cursor (`publishedAt|id`), so new posts never shift pages.
- Trending topics count **distinct authors**, so one account repeating a tag cannot make it trend.
- During the dual-run, a throttled sync (60 s) copies approved earlier education videos into posts when the feed is read. `npx tsx scripts/backfill-posts.ts` also does it, plus follows.
- The feed stays behind the super admin's ecosystem switches (`feed` and `orgPages`).

## Search
`/search` now also searches posts (published, visible ones only) alongside people, organizations, startups and former handles.

## Checks
`tests/interactionCore.test.ts` (rules) and `scripts/device-checks/interactions.cjs` (37 real-database checks: visitor reading, the gate on every action, one reaction per profile, comment limits, follows, follower-list privacy, saved, reports to review, tags, search, hidden posts).

## A post, top to bottom
Video or pictures first, then the title, then the text cut short with "See more" (4 lines in the feed, 8 on the post's own page). Under it: Like, Dislike, Comment, Save, Share and Report. The post's own page (`/post/[id]`) has the same bar as the feed, with the comments already open, a box to write a comment and a Reply under each comment. A visitor can read everything and is asked to join only when they try to take part. Unpublished posts (drafts, held for review) show no reactions.
`scripts/device-checks/post-detail.cjs` checks the order, the bar, dislike, comment, reply and the visitor gate.

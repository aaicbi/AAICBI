# Posts

One content model for what people publish: **text, image galleries (up to 6) and YouTube videos** (no video upload). Everything is a `Post`.

**Who wrote it.** `authorProfileId` is always a Profile. A person posting for a startup (`actingAsProfileId`) shows as "for <startup>"; a training organization's team posts as the organization itself. Who may post as what (`identitiesOf`): a member as themselves or for an approved startup where they may publish; an approved employer or investor as themselves; an approved organization's team as the organization; a super admin as themselves (no review step); other staff as themselves (reviewed).

**Status.** `DRAFT` → `PENDING_REVIEW` → `PUBLISHED`, or `CHANGES_REQUESTED` (the author edits and resends), `REJECTED`, `SUSPENDED` (taken down, can be reinstated). Every change is recorded in `PostReview` with who, when and why. Anything except approving or reinstating needs a reason the author reads. (The unified reviewer queue, reviewer permission and escalation come in step 4; for now a super admin decides through `/api/admin/posts`.)

**Editing.** Drafts and posts needing changes can be edited. Editing a published post changes nothing for readers unless the change is material (wording, title, images or video; spacing and visibility are not): a material edit sends it back to review and hides it until approved again. A super admin's own posts stay published.

**One visibility rule.** `isPubliclyVisible` (`src/lib/posts/postCore.ts`) and its database twin `publicPostWhere` are the only definition of "may this person see this post": published, not held by an organization, and either public or the viewer is signed in. The permalink uses it; the feed and search in step 5 must use it too. Authors (and the startups or organization they post for) and super admins can also open their own non-public posts, and a hidden post and a missing one both return 404.

**Pages and APIs.** `/compose` (write or edit), `/my-posts` (status, reviewer notes, edit, send again, take back, delete), `/post/[id]` (permalink with the author named and linked when their profile is public). `/api/posts`, `/api/posts/[id]` (+ `/submit`, `/withdraw`), `/api/posts/identities`, `/api/posts/mine`, `/api/posts/media` (image upload: JPG, PNG or WEBP up to 5 MB, rate limited). 30 new posts a day per author.

**Earlier videos.** `npx tsx scripts/backfill-posts.ts` copies published, pending, declined and removed educational videos (`EducationPost`) into posts, posted by the member for their organization. The originals are untouched, nothing is copied twice, and demo videos are skipped. The earlier video flow keeps running until the feed moves over in step 5, when this is run once more.

**Not in this step:** reactions, comments, bookmarks and the feed (step 5), reviewer team, escalation, appeals and the organization's block button (step 4; the `orgBlockedAt` hold is already honoured by the visibility rule), polls, mentions.

**Rollback:** drop `Post`, `PostMedia`, `PostReview` (migration `20261020090000_posts`). Nothing else reads them yet.

**Check:** `scripts/device-checks/posts.cjs` (needs the app running against a local database).

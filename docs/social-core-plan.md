# AAICBI social core: implementation map (for approval, no code yet)

Scope: Phase 1 only, a trustworthy social core. YouTube embeds only. No video upload, stories, live sessions.

## Decisions made

1. Start with the social core.
2. Videos stay YouTube embeds (existing `youtubeId`/thumbnail handling is reused).
3. Startups are their own entity with a team and a profile.
4. Trainee posts go to the **central review team** (not first to the organization). An organization that dislikes a post can **block it from public view**.
5. The central team = super admin plus reviewers. Reviewers can **escalate** peculiar cases to the super admin. Reviewers review posts **and** Loop questions, and can **approve Loop answers**.
6. The feed is browsable without an account. Interacting (react, comment, follow, report, bookmark) asks the visitor to create an account, then returns them to the same place.
7. Follower **counts** are public. Follower **lists** are visible to signed-in users only.

## Assumptions to confirm (marked A1..A4)

- A1. An organization's block applies to posts by trainees of that organization. It hides the post publicly at once, the trainee is told why and may appeal to the central team, and a reviewer decides. The super admin can lift or confirm a block.
- A2. Reviewers approve Loop answers, but the consultant switch, the Claude consultant's reports and the AI-feature guidance notes stay super admin only.
- A3. Reviewers are staff accounts granted a "reviewer" permission by the super admin (a flag, not a new role), so existing roles and logins do not change.
- A4. Posts by verified-organization teams get no lighter review in Phase 1. Every post is reviewed.

## What the audit found

Identity is split across five tables: `User` (staff), `Trainee`, `Employer`, `Investor`, `TrainingOrganization` (+ `TrainingOrganizationMember`). Reactions, comments and follows are keyed to `traineeId`; follow is trainee to organization only; `EducationPost` requires a trainee and an organization; `Block` and `ProfileReport` use free-text type strings. Merging the tables would put logins, enrollments, payments and certificates at risk, so it is not proposed.

## Design

### 1. Profile layer (no change to existing accounts)
New `Profile`: `id`, `kind` (PERSON | TRAINING_ORG | EMPLOYER | INVESTOR | STARTUP | STAFF), `handle` (unique, URL-safe), `displayName`, `avatarUrl`, `bio`, `visibility`, link columns to the existing record (`traineeId`, `employerId`, `investorId`, `trainingOrganizationId`, `startupId`, `userId`; exactly one set). Backfilled from existing records by a script that is safe to re-run. Profile page at `/@handle`; old routes keep working and link to it.

### 2. Startup entity
New `Startup` (name, logo, stage, industry, location, problem, solution, public traction, funding interest) and `StartupMember` (role: FOUNDER | MEMBER, permissions: can publish, can edit profile). Pitch decks and confidential files keep explicit access controls and never appear in feeds or search. Existing `PitchSubmission` can be linked to a startup.

### 3. One posts model
New `Post`: author profile, optional acting-as profile (organization or startup), `type` (TEXT | IMAGE | YOUTUBE | LINK_CARD | POLL later), `body`, YouTube fields, `visibility`, status (DRAFT, PENDING_REVIEW, CHANGES_REQUESTED, APPROVED, PUBLISHED, REJECTED, SUSPENDED), `orgBlockedAt/By/Reason`, `escalatedAt/By/Note`, `publishedAt`. Plus `PostRevision` (edits re-enter review when material), `PostMedia`, `PostHashtag`. Existing `EducationPost` rows are copied in; `EducationPost` is read-only after cutover and removed from write paths. A post always shows whether it is personal or on behalf of an organization.

### 4. Interactions across all profiles
New `PostReaction`, `PostComment` (threaded, one level of replies), `Follow` (follower profile to followed profile), `Bookmark`, `Mention`. Existing trainee reactions, comments and organization follows are copied across. `Block` and `ProfileReport` gain profile references (old rows kept). Preferences: who can comment, mention or message. Rate limits on every write.

### 5. Moderation and the reviewer team
- Staff `reviewer` permission flag, granted by the super admin.
- One queue lists pending posts and Loop questions together. Each item can be approved, rejected or sent back with a reason, or escalated to the super admin with a note. Escalated items leave the reviewers' list and appear for the super admin.
- Every decision writes an audit row (who, when, what, reason).
- Backend rule, tested: only PUBLISHED, not org-blocked, not suspended posts appear in the feed, search, profile pages, trending, recommendations and notifications.
- Loop answers: reviewers can approve and edit them (history already records the actor); escalation uses the same mechanism.

### 6. Public feed and search
`/feed` and `/@handle` readable signed-out. Cursor pagination, caching for signed-out requests. Interaction buttons for visitors open a "create an account to continue" prompt that returns to the post after sign-up or sign-in. Follower counts public; follower lists require sign-in. Search covers people, organizations, startups and posts, with partial-name matching and access checks on every result.

## Migrations and rollback
All additive: new tables only, plus nullable columns on staff `User` for the reviewer flag and escalation fields on `GuideUnanswered`. Rollback: stop reading the new tables (feature flag), the old tables are untouched. Backfills are idempotent and verified by row counts before cutover.

## Endpoints (new, indicative)
`/api/profiles/*`, `/api/startups/*`, `/api/posts/*` (create, submit, edit, react, comment, bookmark), `/api/follow`, `/api/feed`, `/api/search`, `/api/admin/review/*` (queue, decide, escalate), `/api/org/posts/[id]/block`.

## Build order inside Phase 1
1. Profiles and handles, backfill, profile pages.
2. Startups and teams.
3. Posts model, backfill from `EducationPost`, authoring UI.
4. Reviewer permission, unified queue, escalation, audit, org block.
5. Interactions, notifications, public feed with the account gate, search.
Each step ships with tests and a regression run of courses, payments and certificates.

## Risks
- Backfill mistakes duplicating or losing content: counts and spot-checks before cutover, dual-read period.
- Accidental public exposure of unreviewed or blocked posts: one shared visibility function used everywhere, covered by tests.
- Review backlog: queue counts and ages on the super admin dashboard.
- Spam from signed-up accounts: rate limits, new-account limits on links and comments.
- Performance of a public feed: pagination, indexes, caching.

## Not in Phase 1
Video upload, stories, live sessions, personalised "For You" ranking, reposts and quote posts, polls, groups, direct-message upgrades, jobs and events as feed cards (Phase 2).

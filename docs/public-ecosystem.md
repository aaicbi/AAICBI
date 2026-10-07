# Public ecosystem (phases 0 to 3)

Organization public pages, trainee education videos, the community feed, and a demo world to try them with. Everything ships **off**.

## Rolling out

1. Run `prisma migrate deploy` (migrations `20261009090000_public_ecosystem` and `20261009100000_ecosystem_feed`). It only adds tables and columns with defaults, so the current site is unaffected.
2. Deploy the code. Nothing public changes yet: `/organizations` and `/learn` return 404.
3. As SUPER_ADMIN open **Platform > Ecosystem** and switch on public organization pages, education videos and/or the community feed. Switching them off again hides the pages at once; no data is deleted.

## How it works

- **Organization page** `/organizations/[slug]`: organizations edit it under *Organization > Public profile* and choose whether it is public. Only name, logo, website, tagline, description, location, cover, programs and published videos are shown. Contact details, billing and trainee lists are never selected.
- **Education video**: an organization picks one of *its own* enrolled trainees and pastes a YouTube link (existing validator in `materialUrl.ts`; only the video id is stored, nothing is downloaded). Author is the trainee, publisher is the organization.
- **Trainee consent**: the trainee is notified and must allow it (*Video requests*) before anything is public, and can withdraw later.
- **Moderation ("Trusted")**: for a SUPER_ADMIN-verified organization a video goes live as soon as the trainee agrees; for any other it waits in *Ecosystem > Videos awaiting review*. SUPER_ADMIN can pull any video.
- **Isolation**: the organization comes from the session on the server. A trainee is "its own" only if enrolled in a course the organization owns (`src/lib/ecosystem/orgScope.ts`).

## Feed and discovery (phase 3)

- **`/feed`**: one mixed stream with filters (All, Learn, Organizations, Jobs, Projects). Newest first, items from followed organizations get a three-day boost, and no more than three of one type appear in a row.
- **What is in it**: published education videos, verified organizations, approved showcase projects, and jobs. Jobs show only to a signed-in trainee who has turned on discoverability (the same rule as the trainee job board). Pitches are not shown: they are investor-only.
- **Trending education** (top of `/learn`): recent published videos ranked by dampened engagement (log-scaled views, likes and saves, decaying with age), at most two per organization, so repeat taps or one organization posting a lot cannot push itself up.
- **Follow, like, save**: signed-in trainees only; one row per person per item, so repeating a tap changes nothing. Everyone else sees a sign-in prompt.
- **Mobile**: a sticky Feed / Learn / Organizations strip under the header. A fixed bottom bar was left out so it cannot collide with the cookie banner and help button.

## Demo accounts

```
npm run db:seed-demo     # create (safe to repeat)
npm run db:reset-demo    # remove only the demo rows
```

Password: `Demo-Pass-123!` locally. In production the seed refuses unless `ALLOW_DEMO_SEED=1` and `DEMO_PASSWORD` are set.

| Role | Login page | Email |
|---|---|---|
| Organization | `/org/login` | `demo-org@demo.aaicbi.invalid` |
| Trainee | `/trainee/login` | `trainee1@` to `trainee5@demo.aaicbi.invalid` |
| Employer | `/employer/login` | `demo-employer@demo.aaicbi.invalid` |
| Investor | `/investor/login` | `demo-investor@demo.aaicbi.invalid` |

Demo rows are flagged `isDemo` or use the `.invalid` domain (cannot receive email), and the reset matches only those.

## Not in this change

Comments, achievements and events in the feed, employer and investor feed views, recommendations, the visibility score, employer and investor discovery, events and global search (later phases).

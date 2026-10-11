# Profiles and handles

Every account (member/trainee, training organization, employer, investor, staff) has one **Profile**: a public identity on top of the existing account tables. Logins, account ids, enrollments and certificates are untouched.

- **Address:** `/@handle` (served from `/p/[handle]` by a rewrite in `next.config.js`). One handle namespace covers every kind.
- **Handle rules** (`src/lib/profiles/handleCore.ts`): 3–30 characters, lowercase letters, numbers, hyphen and underscore, not starting or ending with a symbol, and not a reserved word (`feed`, `admin`, route names, and so on).
- **Existing names are kept:** a member's or staff member's `username`, or an organization's public-page `slug`, becomes their handle. Everyone else gets one made from their display name, with a number added if taken.
- **Visibility is never copied.** `loadProfileView` reads it from the account when the page is opened: members and staff use the existing `canViewProfile` rules, organizations need an approved account with its public page switched on, employers follow their own setting, investors are visible only to themselves and staff. A hidden profile and a missing one both return 404, so the page cannot be used to learn which accounts exist.
- **Creation:** new accounts get a profile at sign-up (`ensureProfileQuietly`, which never fails a sign-up); any account without one gets it on first use. The shadow staff account made for each approved organization is not a person and gets none.
- **Backfill:** `npx tsx scripts/backfill-profiles.ts` creates missing profiles and removes shadow-staff ones. Safe to run again.
- **Checks:** `scripts/device-checks/profiles-check.cjs` and `profiles-signup.cjs` (need the app running against a local database).
- **Rollback:** the table is new and nothing else reads it except the profile page and the handle check. Dropping `Profile` (migration `20261017090000_profiles`) and removing the rewrite restores the previous behaviour.

## One address per person

- `/profile/u/<username>` (the older address) now forwards to `/@handle`, where the full profile is shown: skills, education, experience, projects, certificates, achievements, links and availability for members; job title, department, bio and areas of responsibility for staff. It applies the same visibility check first, so a hidden profile and an unknown one still look the same (no redirect, no confirmation that the person exists).
- A member's or staff member's **username is their handle**. Saving a username (`/api/trainee/profile`, `/api/admin/profile`) checks it as a handle first (valid, not reserved, not held by anyone else, including organizations) and then moves the handle with it. The old API `/api/profile/u/<username>` is unchanged.
- The member profile settings page now shows the member's real `/@handle` address.
- Check: `scripts/device-checks/profiles-address.cjs`.

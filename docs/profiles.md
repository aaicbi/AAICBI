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

- `/profile/u/<username>` (the older address) forwards to `/@handle`, where the full profile is shown: skills, education, experience, projects, certificates, achievements, links and availability for members; job title, department, bio and areas of responsibility for staff. It applies the same visibility check first, so a hidden profile and an unknown one still look the same (no redirect, no confirmation that the person exists).
- A member's or staff member's **username is their handle** and the two are kept equal.

## Changing a handle

A handle is a public address, so a change is **requested with a reason and decided by a super admin**.

- **Asking:** the "Your handle" card on the member, staff and employer profile pages (`HandleChangeCard`, API `/api/profiles/handle-requests`). The new handle must be valid, not reserved and not taken; a reason of 10 to 500 characters is required; one request can wait at a time; at most 5 a day. A request can be withdrawn.
- **Deciding:** `/admin/handle-requests` (super admin only). Approving changes the handle at once. Declining needs a reason, which the person sees. Both notify the person (email and in-app).
- **Direct change:** the same page lets a super admin change a handle directly, for training organizations (which cannot ask) and their own. Same history rules.
- **Usernames are no longer editable in profile settings:** the field is read-only, and the profile APIs refuse a different username (a super admin's own changes go through the direct change).
- **Old handles are kept (`ProfileHandleHistory`):**
  - nobody else can take a former handle, and the handle check reports it unavailable;
  - `/@old` forwards permanently (308) to `/@new`, as does `/profile/u/old`, so existing links and search engines move to the new address;
  - the people search (`/search`, "People and organizations") matches current handles, former handles and names, shows "Formerly @old" for an old-handle match, and applies the profile's visibility rules, so a private profile is never shown;
  - the owner may ask for their own former handle back.
- **Organizations:** the handle changes but the public page address `/organizations/<slug>` does not.
- **Checks:** `scripts/device-checks/profiles-handle-change.cjs` (needs the app running against a local database).
- **Rollback:** drop `HandleChangeRequest` and `ProfileHandleHistory` (migration `20261018090000_handle_changes`) and the handle behaves as before, apart from the read-only username field.

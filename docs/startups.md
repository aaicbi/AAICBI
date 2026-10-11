# Startups

A startup is its own entity with a team and a public profile. Its handle is a `Profile` of kind `STARTUP` (see `docs/profiles.md`), so it appears at `/@handle`, in search, and can change its handle by the same request and history rules.

**Who can do what**
- Any member (trainee account) can found a startup (up to 5). Employers and investors cannot found one yet.
- The founder is the first team member. Founders can invite other members **by handle**; an invited person joins only after accepting (`/trainee/startups`). Nobody is added without saying yes.
- Founders do everything. Other members have flags a founder sets: **may edit the profile**, **may publish for the startup** (used when posts arrive in step 3). Only founders manage the team, send the startup for review, or ask for a handle change. Anyone may hide themselves from the public team list. The last active founder can never leave or be demoted.

**Review**
- A new startup is a **draft**, visible only to its team and staff. A founder sends it for review once it has a tagline, the problem, the solution and an industry.
- A super admin (`/admin/startups`) approves it (it becomes public), declines it with a reason (the team can fix and resend), suspends it with a reason, or reinstates it. Every decision notifies the founders.
- **Verified** is a separate mark a super admin sets, only on an approved startup, when they have actually checked it.
- Edits to an already approved startup go live straight away. Re-reviewing material edits comes with the moderation work (step 4); a super admin can suspend at any time.

**Where it shows**
- `/@handle`: logo, tagline, industry and stage, problem, solution, what the team is looking for (funding, hiring, partners, mentorship), traction and funding notes the team chose to share, the visible team (linked to their profiles), website, and the Verified badge when set. A draft, pending, rejected or suspended startup is a 404 to everyone except its team and staff.
- `/startups`: public directory of approved startups with search and an industry filter, and a "Startups" tab in the discovery bar.
- `/search`: matches approved startups by name or handle, with the rest of "People and organizations".

**Not in this step:** pitch decks and confidential documents with access control, following a startup, posts as a startup (step 3), and linking existing pitch submissions to a startup.

**Rollback:** drop `Startup` and `StartupMember` (migration `20261019090000_startups`) and delete `Profile` rows of kind `STARTUP`; nothing else depends on them.

**Check:** `scripts/device-checks/startups.cjs` (needs the app running against a local database).

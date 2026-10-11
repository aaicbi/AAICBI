# Creating an account: the five account types (phase 3)

## `/join`
One page, five cards: **Trainee, Training Organization, Employer, Investor, Startup**. Each card says who it is for, what it can do, what it asks for, what to know (approval, limits) and what happens next, before anyone types a word. The words live in `src/lib/accounts/accountTypes.ts`, shared by the page and by the banner shown above every registration form ("Creating a Trainee account", with a link back to compare). They describe what the platform actually does, and `tests/accountTypes.test.ts` checks the shape (five types, their routes, no staff option, approval and "no guarantee of funding" stated).

There is no staff, administrator, moderator or super admin option anywhere, and no way to send one: the account kind is never read from the browser.

## The five registrations
| Type | Form | What the server does |
|---|---|---|
| Trainee | `/trainee/register` (unchanged) | Creates an unverified member account; welcome email with a verification link. |
| Training Organization | `/org/register` (unchanged) | Application lands pending; reviewed by the AAICBI team; billing preference recorded. |
| Employer | `/employer/register` (unchanged) | Application lands pending; business registration number required; reviewed. |
| Investor | `/investor/register` (unchanged) | Application lands pending; reviewed. |
| **Startup** (new) | `/startup/register`, three steps | `POST /api/auth/startup-register` creates a member account marked as a founder's and the startup (a draft) with the person as its only founder. |

The existing four forms, their APIs, approvals and payment rules are untouched, apart from the banner above each form and the trainee API now sharing its account-creation code with the founder sign-up (`src/lib/auth/traineeSignup.ts`).

## The founder sign-up
- Step 1 about you (name, email, password twice, optional phone, privacy consent), step 2 the startup (name; tagline, industry, stage, website, location, description all optional), step 3 a summary. Entries are kept when moving between steps, a second tap while sending does nothing, a network failure keeps the form and says so, and every field has a label.
- Server checks everything again (consent, password length, email, startup name, web address starting with http or https), is rate limited like the trainee sign-up (10 an hour per address) and drops unknown fields: a forged `role`, `kind`, `signupKind`, `status` or `verified` changes nothing. The account kind and the startup's status (draft) are set by the server.
- The startup is a **draft**: not public, not in the directory, no public page. The founder verifies their email, signs in, completes the tagline, problem, solution and industry and sends it for review; it becomes public when the AAICBI team approves it (existing startup flow).
- The account is a member account (`Trainee.signupKind = FOUNDER`), so it also has the learning features. The only effect of the marker is the default dashboard: the header's Dashboard button goes to **My Startups** for a founder and to the learner dashboard for everyone else.
- If the startup cannot be saved after the account was created, the account is kept and the person is told to add the startup from My Startups.

## Not changed / still to do
- Organization, employer and investor forms are still single-page forms; they were not rebuilt into steps. Their sign-ins remain separate (`/login` lists them).
- A single sign-in box that finds the right account type by itself is not built.

## Migration and deploy
`20261024090000_trainee_signup_kind` adds `Trainee.signupKind` (text, default `TRAINEE`); existing rows stay `TRAINEE`. No data is changed. Roll back by redeploying the previous version; the column is harmless if left.

## Checks
`scripts/device-checks/join.cjs` (46 real-database checks: `/join` content and links, no staff option, a banner on each registration page, five kinds of rejected founder sign-up, a successful one with the account, startup, founder membership and both profiles, the draft not being public, duplicate email, forged fields ignored, email verification, sign-in, the founder's Dashboard link, and the ordinary trainee sign-up still working and unchanged).

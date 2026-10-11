# Moving courses, sharing links, and people in an organization

## A super admin moves a course to an organization
On the course page (super admin only) **Owner of this course** → choose an organization → **Move course**. The organization's team can then edit it. The course's module assessments, its examination and its assignments move with it; enrolled trainees, their results and certificates are not touched. The certificate template is cleared if it belonged to someone else (templates are per organization). Moving a **paid** course makes you decide where new payments go (see below); the move is refused until you choose. **Bring back to AAICBI** reverses it. The organization is emailed. (`src/lib/courses/transfer.ts`)

### Where new payments go (super admin decides)
Payments always arrive in AAICBI's Paystack account; for an organization on revenue share with a payout account, Paystack splits the organization's portion off. For a paid course, the move asks the super admin to choose:
- **Follow the organization's billing setup:** the split applies when the organization shares revenue and has a payout account.
- **AAICBI keeps the whole payment:** no split, whoever owns the course.

The choice is stored on the course (`Course.paymentsTo`), is shown to super admins in words under **Where new payments go**, and only a super admin can change it later (`PUT /api/admin/courses/[id]/payments`). Organizations, editors and staff admins neither see nor change it. Subscriptions already running are not affected; bringing a course back to AAICBI resets the setting. The split itself is applied in `src/lib/paystack/subscription.ts` through `splitApplies` (`src/lib/courses/payments.ts`).

## Working together with share links
On a course, an examination or an assignment, **Work on this together** makes a link. A signed-in staff member, instructor or training organization opens it and joins as an **editor**.
- Editors change content: modules, lessons, materials, questions, an assignment's details. Editing a course also covers its assessments.
- The owner keeps: deleting, publishing and unpublishing, pricing, the certificate, and who the item is shared with. A super admin counts as an owner.
- Anyone who can edit may invite other editors. Only the owner of a course can make a **copy link**.
- A link works for 7 days and 10 people, can be cancelled at any time, and is shown once: only a hash is stored. Cancelling a link does not remove people already added; the owner removes them, and an editor can leave.
- Shared items appear in the editor's own lists (courses, examinations, assignments).
- Trainees, employers and investors cannot join.
(`src/lib/collab/*`, `/collaborate/[token]`, `/api/collab/*`)

## A copy of a course for another organization
A **copy link** (course owner only) gives whoever opens it their own independent copy: the course page, modules, lessons, materials, the skills it teaches, and the assessments and examination with their questions. The copy is a draft owned by the new owner, who sets their own price, certificate and dates; materials point at the same files. Nothing about trainees comes across. The original is untouched. (`src/lib/courses/copyCourse.ts`)

## Every person in an organization has their own sign-in and role
Team members already signed in with their own email and password; they now also act as themselves. The organization still owns its content (through one internal account), so no ownership rule changed; what is new is that every request knows the person, checks their role from the database, and is recorded.

| Role | Can do |
|---|---|
| Owner | Everything, including billing and the team. |
| Manager | Everything except billing. |
| Editor | Build and edit courses, examinations, assignments, posts. Cannot publish, unpublish, delete, change the public profile, billing or the team. |
| Viewer | Look at everything; change nothing. |

- Choose a role when inviting; change it any time on the Team page. Existing teammates became **managers** so nothing changes for them; new invitations start as **editors**.
- Disabling, removing or demoting someone takes effect on their next request, not when their session would have ended.
- The sidebar shows who is signed in and their role. **Team → Recent activity** (owner and managers) lists what each person changed. It records the request that was accepted, not whether it then succeeded.
- Rules live in `src/lib/org/people.ts` (tested in `tests/orgPeople.test.ts`); enforcement is in `requireRole` (`src/lib/auth/session.ts`) using the request method and path the middleware forwards.
- Not covered: posts and shared items still show the organization as the author or owner, not the person; the activity list is where the person is named.

## Checks
`tests/orgPeople.test.ts`, `tests/collabCore.test.ts`, `tests/coursePayments.test.ts`, and the real-database scripts `scripts/device-checks/course-sharing.cjs` (40: moving, roles, links, copies) and `course-sharing-ui.cjs` (8).

## Deploy
Additive migrations: `20261027090000_content_collaboration` (collaborators and share links), `20261028090000_org_people` (a role on team members, the activity table) and `20261029090000_course_payments_to` (one column on `Course`, default OWNER, so existing courses behave exactly as before). Both are safe to run on a live database. `20261026090000_post_showcase_link` from the posting work also ships here.

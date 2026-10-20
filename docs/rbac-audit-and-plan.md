# Staff permissions, Gaming Studio separation and organization gaming moderation: audit and plan

Status: **Phases 1 to 3 (audit, mapping, plan). No code for the new system has been written yet.**
Written against `main` plus the unmerged commit `d03da8b` ("Game Studio is Super Admin only").

---

## Phase 1. Audit: how access works today

### Accounts and roles
- One cookie session (`lms_session`, signed JWT) carries `{ userId, email, role }`. Roles: `SUPER_ADMIN`, `ADMIN`, `INSTRUCTOR`, `TRAINEE`, `EMPLOYER`, `INVESTOR` (`src/lib/auth/session.ts`, `enum Role`).
- Staff are `User` rows. Staff creation (`POST /api/admin/staff`, Super Admin only) can only create `ADMIN` or `INSTRUCTOR`; the new person receives a set-password email. `SUPER_ADMIN` can never be created from the app (deliberate). A user can be switched off with `User.active`.
- **A training organization signs in as an `ADMIN` session.** Its content is owned by one internal shadow `User` (`TrainingOrganization.staffUserId`). The person behind the session is resolved from the organization owner or `TrainingOrganizationMember` (roles OWNER, MANAGER, EDITOR, VIEWER) on every request (`src/lib/org/actor.ts`, `src/lib/org/people.ts`), so removing someone takes effect at once.
  - Consequence: **role `ADMIN` means two different things**: a real AAICBI staff admin, or an organization. Every gate written as `requireRole("SUPER_ADMIN", "ADMIN", ...)` lets both in. This is how organizations reached the Game Studio.
- 398 `requireRole(...)` call sites: 123 allow SUPER_ADMIN/ADMIN/INSTRUCTOR (mostly "own content" routes that also check course ownership), 86 are SUPER_ADMIN only, 34 SUPER_ADMIN/ADMIN, the rest trainee/employer/investor.
- Existing fine-grained pieces: `User.canReview` (reviewer flag), `User.studioPermissions` (JSON list of 11 studio/platform tool keys, `src/lib/quest/permissions.ts`), `User.loopMaxLevel`/`loopLevel`, `GameResultsShared` platform switch.
- Navigation is a static table with audiences `staff | admins | superadmin | org | staffAndOrg | reviewer` (`src/lib/admin/nav.ts`). The guide (Loop) derives where it may send people from the same table.
- Audit trail exists per feature (`GrowthAudit`, `OrgActivity`, change-request log), but there is **no single audit table** and no permission-change history.

### Gaming
- Game Studio: `/admin/studio`, `/api/admin/studio/**`, Loop inside it (`/api/admin/loop/**`), question bank, game results (`/api/admin/game-results/**`). All gated through `requireStudioUser()` in `src/lib/quest/studioAccess.ts`.
- Ayakbi Arena moderation already exists **per course** and is organization-scoped through course ownership: `GET/POST /api/admin/courses/[id]/arena/moderation` (+ `/matches/[matchId]`), `/arena/chat`, `/arena/ladder`, `/arena/events`. A moderator can end a live match, take a result off the ladder, remove a chat message, suspend a player, close a report; actions are recorded with who did them (`src/lib/arena/moderation.ts`, `ArenaReport`, `ArenaSuspension`). Course group chat and its games (Fastest Fingers, sprints, credits) live under `/api/arena/courses/[courseId]/**` and `/api/admin/courses/[id]/arena/**`.
- **Missing for organizations:** no organization-level Gaming page. Today an organization must open each course one at a time. There is no cross-course results view, live monitor, moderation queue, per-organization policy, "warning" or "escalate to Super Admin" action, or moderation decision log with reasons.
- Game Results table is platform-wide for a Super Admin and course-scoped for staff (`moduleScope`), previously gated by the "shared with staff" switch.

### Where things stand on this branch
- Commit `d03da8b` (unmerged) makes the Studio, Studio-Loop and Game Results Super Admin only and hides them from every non-super account. That is a safe interim answer to "organizations must not have the Studio". The requirement below (Super Admin may grant the Studio to named staff) replaces the all-or-nothing rule, so that commit should be merged first and then refined, not discarded.

### Source of truth for permissions today
There isn't one: role (`User.role`), the nav audience table, `studioPermissions`, `canReview`, org member role, and per-route `requireRole` lists each decide part of it.

---

## Phase 2. Permission mapping

Permission keys are `category.feature:action`. Actions: `view, create, edit, delete, manage, approve, publish, moderate, export, configure, assign_permissions`. A feature lists only the actions that exist for it.

Legend for "today": SA = Super Admin only, STAFF = SA/ADMIN/INSTRUCTOR, ADMINS = SA/ADMIN, ORG = organization session, OWN = own-content (course ownership check also applies).

| # | Category | Existing modules / actions | Gate today | Proposed permission keys |
|---|---|---|---|---|
| 1 | Platform administration | Command Center, Ecosystem switches, Platform settings, Growth, Ads, Pictures, Loop guide, Change requests, Design System | SA (Design System ADMINS) | `platform.command_center:view/manage`, `platform.settings:view/configure`, `platform.features:configure` (growth, ads, ecosystem, pictures), `platform.audit:view`, `platform.announcements:create/publish` |
| 2 | Staff and access | `/admin/staff`, reviewer flag, instructors list | SA | `staff.accounts:view/create/edit/manage(suspend)`, `staff.roles:view/edit/assign`, `staff.permissions:assign_permissions`, `staff.activity:view` |
| 3 | Gaming Studio | Studio pages/APIs, Studio-Loop, game library, items, assignment, question pools, bank, demo | SA (interim) | `gaming_studio:view` (access), `.configs:view`, `.games:create/edit/delete`, `.games:test`, `.games:publish` (publish/unpublish), `.assets:manage`, `.settings:configure`, `.analytics:view`, `.engine:configure`, `.loop:manage`, `.bank:manage` |
| 4 | Gaming operations and moderation | Game results, arena moderation, ladder, chat games, reports | per course (STAFF/ORG) + SA | `gaming_ops.results:view/export`, `.live:view`, `.sessions:moderate` (end/suspend), `.reports:view/moderate`, `.restrictions:manage`, `.chat_games:moderate`, `.incidents:view`, `.escalations:manage`, `.platform:moderate` (all organizations) |
| 5 | Training organizations | Training Organizations, agreement templates, approvals | ADMINS | `orgs.records:view/edit`, `orgs.approvals:approve`, `orgs.status:manage` (suspend), `orgs.settings:manage`, `orgs.analytics:view`, `orgs.members:manage` |
| 6 | Trainees | Trainee profiles, enrolments, performance, cohorts | STAFF/OWN | `trainees.profiles:view/edit`, `.enrolments:manage`, `.cohorts:manage`, `.assessments:view`, `.performance:view`, `.restrictions:manage` |
| 7 | Courses and learning | Courses, modules, materials, exams, assignments, certificates, Q&A | STAFF/OWN | `courses.content:create/edit/delete/publish`, `courses.resources:manage`, `courses.submissions:approve`, `courses.completion:view` (kept ownership-scoped: staff see only what they own or share) |
| 8 | Group chat and community | Course chat, message removal, participant suspension, chat games | course moderators | `chat.rooms:view`, `chat.messages:moderate`, `chat.reports:moderate`, `chat.participants:manage`, `chat.games:manage`, `chat.incidents:view` (private messages never included) |
| 9 | Feed and content | Review inbox, posts, comments, showcase, announcements | reviewer flag / ADMINS | `feed.posts:view/approve/moderate/delete`, `feed.reports:moderate`, `feed.comments:moderate`, `feed.announcements:publish`; `canReview` maps to `feed.posts:approve` |
| 10 | Employers, investors, startups | Employers, job postings, investors, pitches, pitch cohorts, startups | ADMINS/STAFF/SA | `partners.employers:view/approve/moderate`, `.jobs:approve/moderate`, `.investors:view/moderate`, `.startups:view/moderate`, `.listings:moderate` |
| 11 | Messaging and notifications | Messages, platform notifications, templates, growth messaging | STAFF/SA | `comms.messages:view`, `.notifications:manage`, `.announcements:create`, `.templates:edit`, `.logs:view`, `.incidents:moderate` |
| 12 | Reports and analytics | Analytics, performance, growth report, ads report, game results | STAFF/SA | `reports.dashboards:view`, `.organizations:view`, `.trainees:view`, `.gaming:view`, `.platform:view`, `.export:export`, `.sensitive:view` |
| 13 | Billing | Payments, ledger, commission, subscriptions, platform fee | STAFF/ORG | `billing.payments:view`, `.fees:manage`, `.transactions:view`, `.settings:configure`, `.reports:export` |
| 14 | Security and technical | Security logs, integrations status, WhatsApp/Blob/payment keys | SA | `security.logs:view`, `.auth_events:view`, `.restrictions:manage`, `.health:view`, `.integrations:manage`, `.diagnostics:view` (never secrets) |

Overlaps and conflicts found:
1. `ADMIN` is both AAICBI staff and an organization (see above). The new system resolves organization sessions through a separate **organization capability set** and never gives them platform permissions or the Studio.
2. "Own content" routes (123 sites) are not platform permissions; they stay governed by course ownership and the organization member role. Staff get them through `courses.*` plus ownership.
3. Studio and Game Results currently share one gate; they split into Studio (`gaming_studio.*`) and Operations (`gaming_ops.*`), and operations never imply Studio access.
4. `canReview`, `studioPermissions`, `loopMaxLevel` become permission keys or stay as inputs to them (migration below).
5. `GameResultsShared` (share with staff) becomes redundant once `gaming_ops.results:view` exists.

---

## Phase 3. Architecture and migration plan (smallest safe change)

### 1. One resolver, no second system
New `src/lib/rbac/`:
- `catalogue.ts`: categories, features, actions, labels, descriptions, **sensitivity flags** (high risk).
- `templates.ts`: the eight suggested role templates, as data. Templates are only starting points.
- `resolve.ts`: `effectivePermissions(account)` and `can(account, key, scope?)`. Resolution order: **deny by default**. Super Admin: everything. Staff: `template (or legacy defaults) + explicit grants - explicit denies`. Organization session: the organization capability set (below). Everyone else: nothing.
- `guard.ts`: `requirePermission(key, { organizationId? })` built on the existing `requireRole`/`getSession`. Existing routes keep working; sensitive ones switch from `requireRole("SUPER_ADMIN", "ADMIN", ...)` to `requirePermission(...)` one category at a time.
- Permissions are read from the database on every request (like org members today), so a revoked permission applies to existing sessions at once. Nothing is cached across requests.

### 2. Data model (additive migration only; nothing dropped or rewritten)
- `User`: add `staffNumber String?`, `staffRoleKey String?` (template or custom role), `permissionGrants String[]`, `permissionDenies String[]`. `jobTitle`, `active`, `role` already exist and are reused for designation, status and account type.
- `StaffRole` (custom roles): `id, key, name, description, permissions String[], createdById, createdAt, updatedAt`. Built-in templates live in code; edits to a built-in create a custom copy.
- `AuditEvent`: `id, actorId, actorRole, action, resourceType, resourceId, organizationId?, outcome, reason?, before Json?, after Json?, createdAt` with indexes on actor, action, organization and time. One table for permission changes, Studio access, publish/delete, moderation decisions, trainee restrictions, cross-organization attempts, exports. Never stores passwords, tokens or private message text.
- `OrgGamingPolicy` (one row per organization, set by a Super Admin): `resultsView, resultsExport, liveMonitor, endSessions, restrictTrainees, removeParticipants, chatGameModeration, toggleGames, courseRules`, each with a safe default.
- `GameModerationAction`: `id, organizationId, courseId, matchId?, traineeId?, kind (WARNING | RESTRICTION | REMOVAL | SESSION_ENDED | ESCALATED | NOTE), reason, actorType, actorId, escalatedAt?, resolvedAt?, createdAt`. Existing `ArenaReport`/`ArenaSuspension` stay the source for reports and suspensions; this table records decisions and reasons and gives the organization a reviewable history.

### 3. Preserving existing accounts
- Existing staff have `staffRoleKey = null`. Resolution then returns **`legacyDefaults(role)`**, a fixed map that reproduces exactly what that role can do today (verified by a test that compares old gates with the new resolver for each route group). Nobody gains or loses access on deploy, except the Studio change already agreed.
- `studioPermissions` is read once to seed `permissionGrants` (the 11 keys map one-to-one to `gaming_studio.*`/other keys); the old column stays untouched for rollback.
- `canReview` maps to `feed.posts:approve`; reviewer behaviour is unchanged.
- The Super Admin is protected: cannot be edited or suspended through the staff screens, the last Super Admin cannot be demoted, and a Super Admin can never be locked out by a permission change.

### 4. Organization boundary
- Organization sessions (and their members) get an **organization capability set** derived from `OrgGamingPolicy` and the member role. OWNER/MANAGER may moderate; EDITOR/VIEWER may only view (adjustable in decisions below). Never includes any `gaming_studio.*`, any `platform.*`, or other organizations' data.
- Every organization gaming query goes through one helper that resolves the organization from the session (never from the request) and limits to `course.createdById = org.staffUserId` (as course ownership does today), plus trainee enrolment in those courses. Cross-organization identifiers in a request return 404 and write an `AuditEvent` (`CROSS_ORG_ATTEMPT`).

### 5. Anti-escalation rules
- Only `staff.permissions:assign_permissions` holders may change permissions; they may grant only what they hold; nobody edits their own permissions or their own template; high-risk permissions (`assign_permissions`, platform configure, Studio publish/engine, exports, security) can only be granted by a Super Admin.
- Bulk "select all in category" skips high-risk keys unless the Super Admin confirms each; the server re-validates every submitted key against the catalogue and the actor's authority.

### 6. Interface
- **Staff form** (replaces the create form at `/admin/staff`, plus an edit screen): sections A to F as specified (identity, role template, collapsible categories with action columns, effective summary, security warnings, review and save), with search, expand/collapse all, select/clear category, compare against template, view selected. Desktop table matrix, mobile stacked toggles.
- **Navigation** is generated from the resolver: nav items carry a permission key instead of an audience; the same key is used by menu, dashboard cards, quick actions, breadcrumbs, search results and the Loop guide, so they cannot disagree.
- **Organization "Games" section** (new, replaces any Studio entry): Results, Live games, Moderation, Group-chat games, Settings, plus a decision history; built on the existing per-course arena moderation functions, aggregated per organization.
- **Access denied**: one clear page with a link back to the person's own dashboard; the denial is recorded.

### 7. Delivery in slices (each one tested and shippable on its own)
1. **Foundation**: catalogue, resolver, guard, legacy defaults, `AuditEvent`, migration, tests that old behaviour is unchanged. No UI change.
2. **Staff management**: new staff form, role templates, permission summary, history, effective-permissions view, anti-escalation, tests.
3. **Gaming Studio and Gaming Operations**: Studio split into its granular permissions; Studio only for Super Admin or staff granted it; direct URL and API denial; operations permissions separated.
4. **Organization Games section**: results, live, moderation, chat-game moderation, policy, decision log, escalation, isolation tests.
5. **Remaining categories**, one PR each in this order: Billing, Security, Platform administration, Organizations, Feed/content, Employers/investors/startups, Messaging, Trainees, Reports, Courses (ownership-scoped). Each switches sensitive routes to `requirePermission`, keeps legacy defaults, and adds a test comparing before and after.

### 8. Test plan
- Unit: catalogue integrity, resolution order, deny by default, anti-escalation, template diff, legacy-defaults equivalence for every route group.
- Integration/device (existing harness): Studio denied to organization, admin without grant, visitor; allowed to Super Admin and granted staff, with each action separately denied when not granted; revoked permission refused on an existing session; organization A cannot read or act on organization B's results, sessions or reports; staff cannot grant themselves or others beyond their authority; Super Admin cannot be locked out; menus, deep links and the guide agree.
- Regression: login flows, dashboards, games, scores, ladders, group chats, approval workflows (the existing device checks for each).

### 9. Risks and limits
- 398 existing gates cannot be rewritten safely in one change; that is why slice 5 is staged and why legacy defaults exist. Until a category is migrated its routes keep today's behaviour.
- Moderation actions that the game engine does not support (for example removing one player from a live round) will be shown as unavailable instead of faked.
- Private conversations stay private; chat moderation covers course group chats and reported messages only.
- Existing older device checks that assert staff-studio behaviour will need updating as each slice lands.

---

## Decisions needed before coding (recommended answers in bold)
1. **Scope of this build:** slices 1 to 4 (foundation, staff management, Gaming Studio and Operations, organization Games section), then the remaining categories one at a time. (The full 14-category rewrite in a single change is not recommended.)
2. **Organization defaults:** results and moderation switched **on** for OWNER and MANAGER (this is what organizations can already do per course), view-only for EDITOR and VIEWER; Super Admin can switch each capability off per organization.
3. **Existing staff on deploy:** keep exactly today's access (legacy defaults), apart from the Studio, which stays Super Admin only until a Super Admin grants it.

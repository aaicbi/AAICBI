# Event Manager and live session scheduling

AAICBI Ecosystem events: AAICBI's own events, training organisations' classes, meetings and public activities, the Super Admin's review of organisations' requests for public promotion, and the pages where everyone finds, registers for and joins them.

It is built into the existing platform (same database, sessions, permissions, notifications, storage and design system). Nothing about sign-in, dashboards or other features was replaced.

## What was already here (audit)

| Area | Found | Used |
|---|---|---|
| Framework | Next.js 14 App Router, TypeScript, Tailwind brand tokens, Prisma/Postgres, Vercel + Blob | all of it |
| Permissions | `category.feature:action` catalogue, deny-by-default, templates, anti-escalation, `AuditEvent`; organisation roles Owner/Manager/Editor/Viewer | new `events` (staff) and `org_events` (organisation) categories |
| Notifications | `UserNotification` rows + web push; `notifyByEmail` for email | in-app + push only, with a de-duplication table |
| Accounts | `Profile` row for every account kind | registrations are keyed by profile |
| Uploads | Vercel Blob presigned uploads (`ads/upload-token`) | same pattern: `/api/events/upload-token` |
| Approval workflow | review inbox for posts, employers, jobs | a separate, event-specific promotion workflow |
| Existing events | `OrganizationEvent` (title, text, one link), `/events`, `/admin/organization/events`, landing/search/mobile readers | replaced by the new model; rows were copied (same ids), the old table is untouched and unread |
| Calendar | none | built (month, week, day) |

## Two statuses, on purpose

* **Status** is the event's own life: `DRAFT`, `SCHEDULED`, `CANCELLED`, `ARCHIVED`. "Live" and "completed" are worked out from the clock.
* **Promotion status** is whether AAICBI advertises it: `NONE`, `SUBMITTED`, `CHANGES_REQUESTED`, `APPROVED`, `PUBLISHED`, `REJECTED`. An organisation can run an internal event whatever the answer. "Scheduled for publication" is `APPROVED` with a future `publishAt`; an hourly job publishes it.

An event is **public** only when it is scheduled, its audience is Public, and it is published. An organisation's Public-audience event stays an internal event for its own people until the Super Admin (or staff with the publish permission) approves and publishes it. Changing the promotional wording, pictures or category of an approved or published organisation event sends it back for review and takes it off the public pages.

## Who can do what

Staff permissions (category *Events and live sessions*; nobody but the Super Admin has them by default, and the "Platform Administrator" template deliberately excludes them):

| Permission | Allows |
|---|---|
| `events.global:view` (high risk) | see every event, including organisations' private ones, and the global calendar |
| `events.platform:create / edit / publish / delete` | create and edit AAICBI events (or on an organisation's behalf), publish them, cancel and archive them |
| `events.categories:manage` | create, rename, hide categories |
| `events.promotions:view / approve / publish` | read requests, approve, reject or ask for changes, publish an approved event |
| `events.registrations:view / manage / export` | participants of platform events, the attendance register, the CSV (export is high risk) |
| `events.analytics:view` | reports |
| `events.settings:configure` (high risk) | the switches |

A new role template, **Events Manager**, bundles the everyday ones. Organisation permissions (`org_events.*`) are resolved from the person's role: owners and managers do everything; editors prepare events and pictures and see registrations; viewers only look. An organisation never gets anything from the staff category, never sees another organisation's events, and never sees the platform's.

Platform staff do **not** see an organisation's meeting link or passcode, even after approving its promotion.

## Visibility (who sees an event)

Enforced by `canView` in `src/lib/events/eventsCore.ts` for every list and page. Drafts: managers only. Archived: managers with global view only. Cancelled: still visible to the people it concerned.

| Audience | Sees it |
|---|---|
| Public | everyone, once published; before that only the organisation's own people |
| Organisation members | trainees with access to any of the organisation's courses, and its team |
| Selected trainees | the chosen cohorts, courses or trainees |
| Organisation staff | the organisation's team (for an AAICBI event: all organisation accounts) |
| Invited | the people invited |
| Private | the organisation's team and anyone invited |

## Joining details

Meeting link, ID, passcode and instructions live in `EventJoinInfo`, separate from the event. The passcode is encrypted at rest (AES-256-GCM, key derived from `AUTH_SECRET`). No list, card, notification or public page carries them. `GET /api/events/[id]/join` returns them only to a signed-in person who may view the event, has a confirmed registration when the event asks for one, and only from N minutes before the start (default 15, settable per event) until the end. Managers of the event always get them. Opening the link is **never** recorded as attendance: attendance is a register a person keeps after the event starts. The platform does not host, record or stream calls; Google Meet, Zoom, Microsoft Teams and any other https video link are accepted and the service is named when recognised.

## Time

Times are stored in UTC with the event's IANA zone (default Africa/Lagos). The form reads wall-clock time in that zone; every page shows the zone beside the time ("WAT"). Nothing is converted to the viewer's location. Start-before-end, a 14-day limit, past-date refusal (when scheduling) and overlap warnings are checked.

Recurring events are not in the first version. The model has no series concept; adding one later means a `seriesId` and a generator that creates ordinary `Event` rows, so nothing about single events changes.

## Notifications

In-app (and web push for audiences of 200 or fewer): published, invited, reminders (about a day and about an hour before, to registered people and to chosen audiences, not to the whole platform), rescheduled (once per new time), cancelled, promotion submitted/approved/published/declined/changes requested/removed, registration received/confirmed/declined. `EventNotice` has one row per person, kind and event, so a retry or a second press never sends twice. Failures never break the action. No email is sent to the whole platform.

## Pages

* `/events`: directory with Upcoming / Live now / Past, search, category, kind, delivery, organiser, dates, and (signed in) public versus organisation events.
* `/events/[id]`: the event, with registration and the join button.
* Feed (`/`, `/feed`): an "Upcoming events" row of flyer cards.
* Dashboards: an "Upcoming events" card for trainees, employers, organisations and Super Admin/staff.
* `/admin/events` (platform) and `/admin/organization/events` (organisation): the Event Manager with its sections, calendar, promotion queue, registrations, reports and settings; `…/new`, `…/[id]`, `…/[id]/edit`.

## APIs

Public/participant: `GET /api/events`, `/api/events/[id]`, `/api/events/[id]/join`, `POST|DELETE /api/events/[id]/register`, `GET /api/events/categories`, `POST /api/events/upload-token`.
Manager (the same handlers under two prefixes; who is acting decides what is allowed): `/api/admin/events…` and `/api/org/events…`: list/create, `[id]` (get, update, delete draft), `cancel`, `archive`, `promotion`, `registrations`, `export`, `audience`. Platform only: `/api/admin/events/categories`, `/api/admin/events/settings`.
Cron: `GET /api/cron/event-sweep` (hourly, `CRON_SECRET`).

## Data

Migration `20261202090000_events`: `Event`, `EventJoinInfo`, `EventTarget`, `EventMedia`, `EventRegistration`, `EventActivity`, `EventNotice`, `EventCategory`, `EventSettings` and six enums; seeds the settings row and seven categories; copies existing `OrganizationEvent` rows into `Event` (same ids; no end time becomes start + 2 hours). Nothing is dropped or altered.

## Tests

* `tests/events.test.ts`: rules (time zones, links, validation, lifecycle, promotion order, visibility, join window, registration, reminders, calendar, encryption).
* `tests/rbac.test.ts`: catalogue separation and the new templates.
* `scripts/device-checks/events-api.cjs`: 79 end-to-end checks over HTTP, and `events-followups.cjs` another 34 (series, report import, email, the hourly job, uploads) against the local database (permissions, isolation, promotion, joining details, registration, notifications, switches).
* `scripts/device-checks/events-ui.cjs`: every screen in a real browser on desktop and phone.

## Repeating events

On the Date and time step of a new event, **Repeat** makes a series: every day, every week (optionally on chosen weekdays) or every month, stopping after a number of events (2 to 52) or on a date (within a year). Each occurrence is an ordinary, separate event at the same clock time in the event's zone, so a 10:00 class stays at 10:00 across a clock change. Every date is validated before anything is saved, and a failure removes what was made. Only the first event announces itself (one notice, not a dozen); reminders still go out for each. Cancelling an event offers "this event only" or "this and all later events in the series". Repeating events cannot be submitted for public promotion all at once: ask for promotion on each event you want promoted. Editing is per event.

## Attendance

Joining a call is never counted. Attendance is a register an organiser keeps, in two ways: ticking people, or **importing an attendance report**. Google Meet, Zoom and Microsoft Teams can each export who joined; upload that CSV (Zoom's summary lines, tab-separated Teams files and UTF-16 are handled), and people are matched to confirmed registrations by email, or by an exact, unique name when the file has no email. People who stayed under a chosen number of minutes (default 5) are set aside, the organiser previews the match before anything is saved, only people are added as present (nobody is marked absent), and each is labelled "from report". This records a file the organiser uploaded; there is no live link to those services, and a direct integration would need each provider's credentials and approval.

## Email

Personal notices are also emailed (through the platform's existing email service) to the people concerned: invitations, reminders, new times, cancellations, registration updates and promotion decisions. The platform-wide "a new public event was published" announcement stays in the app, and notices to more than 500 people stay in the app. Emails carry the same words and a link to the event page, never a meeting link or passcode. Each attempt is recorded in the notification log. The Super Admin can switch event email off in Event settings. There are no per-person email preferences on the platform yet.

## Scheduling, uploads and set-up checks

* The hourly job (`/api/cron/event-sweep`, in `vercel.json`) publishes events set to publish later and sends reminders. It records when it last ran; the Event Manager overview warns Super Admins when it has been quiet for three hours, and Event settings shows the last run. It needs `CRON_SECRET`.
* The event form asks the server whether file uploads are set up (`BLOB_READ_WRITE_TOKEN`) and, if not, says so and disables the file pickers; a YouTube or Vimeo link still works.
* Settings, Integrations now lists File Storage and Scheduled Jobs (cron secret) beside the other services.

## Linting

`npm run lint` is set up (`.eslintrc.json`, `next/core-web-vitals`, `react/no-unescaped-entities` off because apostrophes in JSX text are valid). It reports no errors; the remaining warnings are older code (plain `<img>` tags, hook dependency lists, PDF image alt text). A function named `useHint` in the question practice route was renamed `takeHint`, because the linter rightly took it for a React hook.

## Known limits

* Meeting attendance cannot be verified live: there is no integration with Meet, Zoom or Teams, only the manual register and the report import above.
* Series are created together; changing a whole series at once (rather than event by event) is not built.
* Flyer and video uploads were exercised only up to the server's permission and set-up checks, because the real upload needs a Vercel Blob token that is not available in the test environment.
* Email depends on the existing email service being configured; there are no per-person email preferences.
* Registration for an event aimed at a profile (an invited employer, say) works; picking such people in the form is limited to trainees, cohorts and courses.

# CRM email composer

Status: built (one-to-one email from a registration). Bulk sending, campaigns and AI drafting come later.

## What it does
Staff (and training organizations the Super Admin has switched the CRM on for) write an email to someone who registered for a course, from a registration's **Email** button (`/admin/crm/compose?r=<registration>`): pick an approved sender and a template, fill in the subject and message, preview on desktop and phone, then **Send now**, **Send test to me**, **Save draft** or **Schedule**.

## Rules that are enforced on the server
- **Senders** are approved by a Super Admin (`/admin/crm/senders`). Mail goes out only from a sender marked **verified** (the Super Admin's confirmation that the domain is verified in Resend), **active**, with a **reply-to** set, and on the right stream (service or marketing). The starter senders, `admissions@mail.aaicbi.org` and `hello@mail.aaicbi.org`, start unverified.
- **A training organization** sends as "<Organization> via AAICBI" from the shared address, with replies going to the organization, and only from senders that allow organizations.
- **Consent.** A *service* message (about their registration) needs the follow-up tick. A *marketing* message needs the newsletter tick and a marketing sender (none exists yet, so marketing is blocked until one is added). Anyone who stopped all messages, or whose address bounced or was reported as spam, is refused.
- **Merge fields** are an allowlist (`first_name`, `last_name`, `full_name`, `course_name`, `cohort_name`, `application_reference`, `application_status`, `payment_status`, `organisation_name`, `assigned_staff_name`, `support_email`, `course_start_date`). An empty one uses a safe fallback. Values are escaped and never read as templates. An unknown field is refused.
- **The body** is cleaned to a small set of tags before it is stored or sent (no scripts, styles, images, forms, handlers or odd links); the subject cannot carry a header; the From name cannot inject a header. A plain-text version is made automatically.
- **Attachments**: up to 3 files, 3 MB together (Vercel accepts request bodies up to 4.5 MB and files travel as base64); PDF, images, Word, Excel, PowerPoint, text or CSV.
- **Limits**: 60 emails an hour per person writing, 5 a day to the same registrant, 20 tests an hour.
- **Test sends** go to the writer's own address with "[Test]" in the subject and are not put on the registrant's timeline.

## What the timeline says
Sending hands the email to Resend. It is stored as **Accepted by Resend**, never as delivered. Resend's signed delivery reports (`POST /api/webhooks/resend`, checked with `RESEND_WEBHOOK_SECRET`) then move it to **Delivered**, **Delivery delayed**, **Bounced** or **Reported as spam**. A status never goes backwards, a repeated report is recorded once, and opens and clicks are recorded without changing the status (opens are approximate). A permanent bounce or a spam complaint switches the address off for future email and leaves staff a task.

## Scheduling
A scheduled email is sent by the hourly job `/api/cron/crm-email` (`CRON_SECRET`, at 30 minutes past the hour). It is claimed before sending so it cannot go out twice, and consent is checked again at send time: someone who opted out after it was scheduled is skipped, with a note on the timeline.

## Templates
`/admin/crm/templates`. Four starters: Registration received, Missing information, Course starts soon, Welcome and next steps. People with the edit permission change them; every save that changes the words is a new version and each sent email records the version it used. Organizations can read them.

## Permissions
Staff: `crm.email` (view, create), `crm.templates` (view, edit), `crm.senders` (view, manage, high risk). Organizations (when the CRM is on): `org_crm.email` (view, create), `org_crm.templates` (view). The **CRM and Admissions Officer** template includes sending, reading templates and seeing senders.

## What you must do outside the app
1. Add `mail.aaicbi.org` in Resend, add the DNS records it shows (MX and TXT for SPF, a DKIM TXT, and a DMARC TXT on `_dmarc`), and press Verify.
2. Create a sending API key and set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel.
3. In Resend add a webhook to `https://<your site>/api/webhooks/resend` for sent, delivered, delivery delayed, bounced, complained, opened and clicked, and set its signing secret as `RESEND_WEBHOOK_SECRET`.
4. In `/admin/crm/senders` set each sender's reply-to and turn **Verified** on.
Inbox placement cannot be promised; Resend can only report that the receiving server accepted the message.

## Where things are
`src/lib/crm/emailCore.ts` (pure rules, `tests/crmEmail.test.ts`), `webhookCore.ts` (signature check), `email.ts` (compose options, send, schedule, delivery reports), pages `src/app/admin/crm/{compose,templates,senders}`, APIs `src/app/api/admin/crm/{email,senders,templates}`, `src/app/api/webhooks/resend`, `src/app/api/cron/crm-email`, migration `20261206090000_crm_email`, device check `scripts/device-checks/crm-email.cjs` (uses a local Resend stand-in, `RESEND_BASE_URL`).

## Not in this step
Bulk sends, campaigns and segments, a marketing sender, approval for large sends, AI drafting, organization-owned templates, and open or click tracking links.

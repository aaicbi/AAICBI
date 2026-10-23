# CRM step 1: course registration

Status: built. Pre-registration only: it records interest, consent to be followed up and a signed agreement. It is not admission and takes no payment.

## The journey
1. **Two doors, one form.** A link or QR code (`/register/<course>`, with an optional `?src=name` tag; `?src=qr` marks a QR code) and the **taster game** result screen, which now shows "Register for <course>" (the course name is on the button), "Try a free course" (`/free-courses`) and a small text link to Module 1 free.
2. **The page** shows the course (summary, outcomes, outline, requirements, fee line), then a short form, the agreement and two separate ticks: *contact me by email and WhatsApp about this course* (required, the follow-up consent) and *news and offers* (optional).
3. **Signing** is a typed full name plus a tick. The signed name must contain the first and last name given. The exact agreement version, the time, the name, a keyed hash of the IP address (never the address) and the browser string are saved.
4. **On submit** the person becomes a CRM contact (one per owner and email, so a repeat is an update, not a duplicate), a registration with a reference like `REG-2026-K7M2QX`, two consent records (follow-up, newsletter), three timeline entries and a follow-up task due in a day. The same email on the same course returns the same reference.
5. **After the save**, a confirmation email goes to the person and a notice to the owner. Neither can undo the registration. The email is recorded on the timeline as *accepted by the mail provider* or *could not be sent*, never as delivered.
6. **Confirmation page** (`/register/<course>/done?ref=...`) shows the reference, next steps and free courses to try while waiting. It shows nothing personal.

## When a course takes registrations
Published (or unlisted) and either a scheduled "coming soon" / "registration open" course (it has a start date) or switched on by staff (course page, **Registration page** card). Closed at the deadline, when full (capacity) or when the course has ended. A staff switch keeps a rolling course open after its start date.

## Who sees what
- The owner of a registration is the course's training organization, or AAICBI. Contacts are unique per owner, so two organizations never see each other's people.
- Super Admin: every registration. Staff: AAICBI's own. A training organization: only its own, and only when a Super Admin has switched the CRM on for it (**CRM settings**). Registrations are saved either way, so no sign-up is lost.
- Permissions (catalogue `crm.*` for staff, `org_crm.*` for organizations): registrations view / manage / export, contacts view / edit, agreement view / edit, CRM switches configure. The role template **CRM and Admissions Officer** is a starting point. Without the contacts permission, emails are masked and phone numbers hidden.
- Organization roles: owner and manager do everything; editor can view and work registrations but not export; viewer sees nothing.

## Protection
Server-side validation, a hidden field and a minimum time open (bots), 150 attempts an hour per address (a room can share one Wi-Fi) and 8 an hour per email, markup and spreadsheet-formula names refused, CSV cells defused, every export audited, agreement edits and CRM switches audited.

## Agreement
One agreement for everything, versioned. Version 1 is **starter text**: have a lawyer approve the final wording. Publishing a new version makes it the one everyone signs; earlier registrations keep the version they signed.

## Opt-out
Every email carries a private stop link (`/crm/optout/<token>`). It switches off all consent and is shown to staff. Registering again with a fresh tick is new consent.

## Where things are
`src/lib/crm/registrationCore.ts` (pure rules, `tests/crmRegistration.test.ts`), `registration.ts` (save, email, notices), `staff.ts` (scoped lists, detail, changes, export), pages `src/app/register/**`, `src/app/admin/crm/**`, `src/app/free-courses`, migration `20261205090000_crm_registrations`, device check `scripts/device-checks/crm-registration.cjs`.

## Not in this step
The email composer, bulk sending, pipelines beyond a stage, assignment to a staff member, WhatsApp sending (the consent is recorded; messages are sent by hand or by the existing growth messaging), payments and admission decisions, and the AI features.

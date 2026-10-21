# User manuals: documentation report (version 1.0, 20 October 2026)

## Deliverables

| Deliverable | Location |
|---|---|
| Training Organisation User Manual (71 pages) | `docs/manual/output/AAICBI Training Organisation User Manual v1.0.pdf` |
| Trainee User Manual (52 pages) | `docs/manual/output/AAICBI Trainee User Manual v1.0.pdf` |
| Combined edition, Part A and Part B (120 pages) | `docs/manual/output/Combined AAICBI Ecosystem User Manual v1.0.pdf` |
| Original screenshots (164 computer and phone captures, by audience) | `docs/manual/screenshots/{shared,org,trainee}/` |
| Editable sources | `docs/manual/src/` (text in `src/content`, design in `src/style.css`, builder `build.cjs`) |
| How to rebuild or update | `docs/manual/README.md` |

## How the manuals were made

The platform was built and run locally against a throwaway demonstration database (never production). Screenshots were taken with a real browser at 1440 × 900 (computer) and 390 × 844 (phone) in the platform's default dark theme, signed in as demonstration accounts (an organisation owner and a trainee) with sample data. Numbered marks on key screenshots were placed automatically from the position of the real on-screen element, so they point at the actual controls. Wording and button names were checked against the live screens and the page code. The platform was not changed.

## Workflows covered

Public home and feed, search, the Join page and account types, organisation registration and approval, organisation and trainee sign-in, trainee registration and email verification, the organisation workspace (Overview, Dashboard, menus, roles), public profile, team, courses (create, manage, enrol, cohorts, early warnings, performance, Q&A, certificates), examinations, assignments, certificate studio, education videos, program skills, events, member posts, content and visibility, the organisation Games section (results, live games, moderation, chat games, settings, history, escalation), messages and notifications, settings and support; for trainees: dashboard, courses, joining, practice, assessments, examinations, assignments, certificates, progress and analytics, Ayakbi Arena, course chat, ladder, feed and posting, messages, notifications, profile and settings.

## Things found while documenting, and how each was resolved

Five platform gaps were found while documenting. All five were then fixed in the application and the manuals were updated to describe the fixed behaviour:

- The organisation sign-in page had **no “Forgot password” link**. Now it has one, with `/org/forgot-password` and `/org/reset-password` for owners and team members.
- Organisations had **no usable “all trainees” page** (`/admin/trainees` showed “We couldn’t load trainees”). There is now **Organization → Trainees**, limited to the organisation’s own trainees; the old address redirects to it. (`/admin/cohorts` is still not a page: cohorts live inside each course.)
- The organisation **Dashboard** showed the AAICBI team’s review counters (pending employers, job postings, flagged profiles) and staff-only links. These are hidden for organisations.
- The inert **AI Platform Assistant** switch was removed from Settings.
- Neither Settings page had a **change password** box. Both now have one (current password, then the new one twice).
- The **Gaming Studio** is not described as an organisation feature anywhere; the manual states that organisations do not have it.

## Remaining gaps and items for approval

1. **Support contact:** no support email, phone or help page is published inside the platform pages. A clearly marked placeholder in “Getting help” must be replaced with approved details. Organisations can already use **Settings → Message the Super Admin**.
2. **Password reset emails** need email sending to be configured for the environment (the same as the existing trainee reset). The reset links in the manual describe the normal behaviour once email is working; in the local test environment the reset token was read from the database.
3. **Branding:** the AAICBI logo and brand colours from `docs/brand` were used; no replacement was invented. The PDF pages are light (for printing) while the screenshots are dark (the platform default).
4. **Screens not photographed because they need data the demo did not have:** an actual assessment attempt in progress, a paid-course checkout (Paystack), a published public organisation page seen by a visitor, an organisation’s game results with exports switched on, and the trainee’s own course group chat with several people typing at once. They are described in text.
5. **Games screens** use sample game activity added to the demonstration database so the tabs show realistic data; real organisations will see their own.
6. A few numbered marks could not be placed automatically on some phone screens (the element was off screen); those figures show fewer marks.
7. **PDF checks:** opened and inspected page by page as images; page numbers, contents and internal links were generated. The PDFs were not opened on a physical phone or in every PDF reader; please do a final read-through on your devices.
8. **Combined edition:** both parts share one glossary and one “Getting help” page, so the organisation-only wording about the Super Admin message box appears there; check that wording before wide distribution.

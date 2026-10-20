# User manuals: documentation report (version 1.0, 20 October 2026)

## Deliverables

| Deliverable | Location |
|---|---|
| Training Organisation User Manual (71 pages) | `docs/manual/output/AAICBI Training Organisation User Manual v1.0.pdf` |
| Trainee User Manual | `docs/manual/output/AAICBI Trainee User Manual v1.0.pdf` |
| Combined edition (Part A and Part B) | `docs/manual/output/Combined AAICBI Ecosystem User Manual v1.0.pdf` |
| Original screenshots (164 computer and phone captures, by audience) | `docs/manual/screenshots/{shared,org,trainee}/` |
| Editable sources | `docs/manual/src/` (text in `src/content`, design in `src/style.css`, builder `build.cjs`) |
| How to rebuild or update | `docs/manual/README.md` |

## How the manuals were made

The platform was built and run locally against a throwaway demonstration database (never production). Screenshots were taken with a real browser at 1440 × 900 (computer) and 390 × 844 (phone) in the platform's default dark theme, signed in as demonstration accounts (an organisation owner and a trainee) with sample data. Numbered marks on key screenshots were placed automatically from the position of the real on-screen element, so they point at the actual controls. Wording and button names were checked against the live screens and the page code. The platform was not changed.

## Workflows covered

Public home and feed, search, the Join page and account types, organisation registration and approval, organisation and trainee sign-in, trainee registration and email verification, the organisation workspace (Overview, Dashboard, menus, roles), public profile, team, courses (create, manage, enrol, cohorts, early warnings, performance, Q&A, certificates), examinations, assignments, certificate studio, education videos, program skills, events, member posts, content and visibility, the organisation Games section (results, live games, moderation, chat games, settings, history, escalation), messages and notifications, settings and support; for trainees: dashboard, courses, joining, practice, assessments, examinations, assignments, certificates, progress and analytics, Ayakbi Arena, course chat, ladder, feed and posting, messages, notifications, profile and settings.

## Things found that are not as a reader might expect (documented as limitations)

- The organisation sign-in page has **no “Forgot password” link**. The manual says so and points to the support placeholder.
- Organisation accounts have **no “all trainees” page**: the address `/admin/trainees` shows “We couldn’t load trainees”, and `/admin/cohorts` is a “page not found”. The manual describes the real routes (Overview, a course’s Enrollments, Performance, Messages) instead.
- The top three tiles of the organisation **Dashboard** (pending employers, job postings to review, flagged profiles) are review counters shared with the AAICBI team’s dashboard. They are explained, not recommended for daily use. This may be worth a product review.
- The **AI Platform Assistant** switch in organisation Settings says the feature is not available yet; the manual says the same.
- Neither the organisation nor the trainee **Settings** page has a “change password” box; trainees reset through “Forgot your password?”.
- The **Gaming Studio** is not described as an organisation feature anywhere; the manual states that organisations do not have it.

## Remaining gaps and items for approval

1. **Support contact:** no support email, phone or help page is published inside the platform pages. A clearly marked placeholder in “Getting help” must be replaced with approved details. Organisations can already use **Settings → Message the Super Admin**.
2. **Sign-in help for organisation owners** has no in-platform route; it depends on the support contact above.
3. **Branding:** the AAICBI logo and brand colours from `docs/brand` were used; no replacement was invented. The PDF pages are light (for printing) while the screenshots are dark (the platform default).
4. **Screens not photographed because they need data the demo did not have:** an actual assessment attempt in progress, a paid-course checkout (Paystack), a published public organisation page seen by a visitor, an organisation’s game results with exports switched on, and the trainee’s own course group chat with several people typing at once. They are described in text.
5. **Games screens** use sample game activity added to the demonstration database so the tabs show realistic data; real organisations will see their own.
6. A few numbered marks could not be placed automatically on some phone screens (the element was off screen); those figures show fewer marks.
7. **PDF checks:** opened and inspected page by page as images; page numbers, contents and internal links were generated. The PDFs were not opened on a physical phone or in every PDF reader; please do a final read-through on your devices.
8. **Combined edition:** both parts share one glossary and one “Getting help” page, so the organisation-only wording about the Super Admin message box appears there; check that wording before wide distribution.

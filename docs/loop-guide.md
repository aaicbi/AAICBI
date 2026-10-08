# Loop, the ecosystem guide

Loop is the small round helper on every page: a character with a short hint now and then, and a chat window that answers questions about the platform and links to the right page. It uses **no AI service**. Answers come from written answers, and it works in the browser.

## What visitors get
- A round button (bottom right) on every page except exams, assessments, assignments, staff areas and the Command Center. The organization workspace is the one staff area where it shows. It replaces the plain page-help button wherever it appears, and that button returns when Loop is off.
- At most two short comic-style hints per visit, never twice on the same kind of page, never while typing, with "Stop these hints" (remembered). Animations switch off for anyone whose browser asks for reduced motion.
- A chat window: greeting for the page, starting actions, similar questions as you type, answers with real links. Not modal; Escape or the minimize button closes it and focus returns to the button.
- Loop explains "What can I do on this page?" from the existing page-help notes.
- It does not answer course, exam or assignment questions, and says so.

## How an answer is found (`src/lib/guide`)
1. The question is reduced to meaningful words (`text.ts`): lowercase, filler removed, plurals trimmed, and words that mean the same here ("course", "program", "class", "training") mapped to one.
2. Each written answer gets a score (`match.ts`): how much of the question it covers (rarer words count more), how much of the written question was touched, and a small tie-break on the visitor's own words. An answer written by SUPER_ADMIN wins a close call.
3. A good score gives that answer; a weaker one gives "Did you mean"; nothing gives a fallback listing good places to start.
4. If the question names a skill the platform really has (taken from course, job, video and trainee skills), the answer also offers links that search for it (`/search?q=`, `/jobs?q=`, `/trainees?q=`), ordered by what was asked.
5. Links to pages that are switched off (jobs, trainees, organizations, videos, feed) are removed (`links.ts`).

## Managing it (SUPER_ADMIN)
- **Command Center**: a switch for Loop and a link in, and **Platform > Loop guide** (`/admin/command/guide`).
- **Questions Loop could not answer**: grouped with a count, most asked first. Write an answer once (it becomes a written answer for everyone) or dismiss.
- **Answers you wrote**: add, edit, switch off, remove (up to 200). Links must be paths on this site; pick from the list or type one. Changes reach visitors within a minute.
- The 29 built-in answers are in `src/lib/guide/defaults.ts`. They state no prices, numbers or promises, and link only to pages in the directory (`links.ts`); tests enforce both.

## Privacy
Unanswered questions are stored as text only, after emails, links, phone numbers and long digit runs are replaced. No account, IP address or browser detail is kept; the rate limit uses the address but does not store it with the question. Nothing is stored while Loop is off.

## Switches and data
- `PlatformSettings.guideEnabled` (default on). `GuideEntry` (written answers) and `GuideUnanswered` (queue). Migration `20261011090000_loop_guide` only adds.
- Public routes: `GET /api/guide/config` (cached a minute at the edge, nothing about any person), `GET /api/guide/me` (never cached, only the kind of account), `POST /api/guide/unanswered` (rate limited). Admin routes under `/api/admin/guide` need SUPER_ADMIN.

## Guides for training organizations (playbooks)

Loop walks a signed-in training organization through its workspace one step at a time.

- **Where:** Loop now shows on every `/admin/*` page for an organization's session (staff still do not see it there). It reads who is signed in early on those pages (`useMeForPath`). On the workspace it offers "Guide me" shortcuts for the page you are on.
- **How it starts:** each guide has a question (for example "How do I upload a course?"). The ordinary matcher finds it and the chat shows a step card with Back / Next, the page to open, a tip, and guides to try next. The step is remembered for the visit.
- **Where the content lives:** `src/lib/guide/playbooks/data.ts`. **Bold** text marks an exact label in the interface.
- **Keeping it true:** `tests/guidePlaybooks.test.ts` fails if a bold label no longer exists in the source, if a step links to a page that does not exist, or if a guide stops being found by its question. Rename a button and the test tells you which guide to update.
- **Guides today:** workspace tour, upload and publish a course, module assessment, final course examination, price/schedule/details, enroll trainees and cohorts, certificates, public page, invite a teammate, trainee education video, program skills, events, content and visibility, payments and reports.
- **Things the guides say plainly:** a new course is a draft; publishing needs at least one module; module assessment questions come from an uploaded Word document (no typed entry); the final exam is generated from published module assessments and must be reviewed.

### Trainee guides

The same playbook engine has guides for trainees (`audience: "trainee"` in `data.ts`): tour of the trainee area, getting started, enrolling (free, paid, free preview, unlock code), lessons and unlocking modules, module assessments, the course examination and certificate, assignments, sharing a certificate, profile visibility, jobs and introductions, getting help, and settings. A signed-in trainee gets "Guide me" shortcuts on each trainee page. Loop still stays hidden on live exams, assessments and the assignment workspace.

Guides are matched by audience (`entriesForAudience`): organizations only see organization guides, everyone else sees trainee guides, so similar questions reach the right one. A test checks that no guide ever takes over a plain written answer.

---

# Loop as a navigator and a learning knowledge system

Loop still has no AI service. It answers from written answers and step-by-step guides, now with three additions: a reviewed knowledge workflow, real navigation, and on-screen pointing.

## How Loop learns (and what it never does)

```
Question Loop can't answer (or answers with low confidence, or is marked "not helpful")
        -> kept, scrubbed, grouped with questions that mean the same
        -> Guide Bot Knowledge > Needs review (highest priority first)
        -> a person writes or approves the answer
        -> it becomes a versioned, approved answer
        -> Loop finds it next time, however the question is worded
```

- Visitors can **never** teach Loop directly. Nothing becomes an answer without a SUPER_ADMIN writing or approving it.
- Unknown questions get an honest reply ("I don't have a reliable answer for that yet, but I've recorded your question…"), never an invented one.
- What is kept about a question: scrubbed text (emails, links and numbers removed), the kind of account (read from the session, never trusted from the browser), the page title and route with ids stripped, the last few things typed (scrubbed), the confidence, and the closest answer Loop tried. Never who asked, never an address.
- Similar wordings are grouped by concept words (`src/lib/guide/similarity.ts`): "How do I message an employer?", "Where can I chat with an employer?" and "How can I send a message to an employer?" are one topic with a count and the other wordings listed. Word-based grouping is honest about its limit: questions that share almost no words stay separate; merge them by hand.
- Priority (`priority.ts`): how often, how many kinds of account, how recently, and whether it touches paying, applying, signing in, certificates or messaging.
- Confidence: an answer scoring under `ANSWER_CONFIDENT` is given with "Is this what you were asking about?" and also queued. A question asked again after being answered goes back to the queue (the answer's wording or keywords need work).

## Guide Bot Knowledge (`/admin/command/guide`, SUPER_ADMIN)

Overview (30-day numbers, resolution rate, **where people get stuck**: questions grouped by the part of the product they were asked on, a signal for navigation, labels and onboarding) · Needs review (filters by status, kind of account, category, area, search; Write an answer, Start review, Merge into a question or an existing answer, Mark resolved, Reject with a reason, Dismiss, Reopen) · Frequently asked · Knowledge base · Navigation knowledge · Learning history · Categories · Pointing targets · Settings.

Every approved answer can carry: a category, who it is for, other ways people ask it, a destination (**Take me there**), and a control to light up (**Show me**). Every create, edit, disable, enable and restore is a **version** (who, when, note). Restoring brings an old version back as a new one; history is never rewritten. Counters (answers given, helpful / not helpful, navigations, tours) are daily numbers with no text and no identity.

## Navigation, by account type

`src/lib/guide/navigation.ts` builds the places Loop can take someone from the menus the platform already has (trainee, employer, investor, organization and staff sidebars) plus the public pages, so a renamed page is followed automatically. Each place knows which account may open it.

- "Where is Analytics?" gives **Open Analytics & Reports** and **Show me**. "Open messages" goes there at once. "Show me how to use…" lights it up.
- The same question gets a different page per account: Messages is `/trainee/messages`, `/employer/messages` or `/admin/messages`.
- A feature that belongs to another account is never linked or highlighted. Loop says so ("That feature … is available to trainees. Your current account doesn't have access to it.") and offers the sign-up page when that is a way to get access. A visitor is told to sign in.
- Intent (`intent.ts`): information, navigation, instruction, demonstration, action.

## Pointing at the screen

A control opts in with `data-guide-target="some-id"`; every menu item carries `nav:<page address>` automatically. Loop never finds controls by their text or position.

- `GuideSpotlight` draws a soft animated beam around the target, scrolls it into view (not while the person is typing elsewhere), focuses a field on a computer (not on a touch screen, to keep the keyboard down), and notices when the person uses it: a click, or typing then a pause, so a guide moves on by itself.
- On a phone, a menu item that is not on the bottom bar points at **More** first, then at the real item once More is open.
- The small card explaining the step moves to the other side if it would touch the target. Esc ends a guide. The chat tucks itself away while pointing.
- Guided tours are the existing playbooks: steps may now carry `target`, `page` (where the control lives) and `completeOn`. A step on another page offers **Take me there**. A test checks every named target exists.
- **Reduced motion** gets a still, double high-contrast outline with no animation. The beam is slow (2.8 s halo, 3.6 s sweep) and never flashes.
- To make a new control pointable: add `data-guide-target="its-id"`, list it in `src/lib/guide/controlTargets.ts` (a test keeps the list honest), and use it in a playbook step or an approved answer.

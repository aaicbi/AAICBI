# Accessibility testing

Two layers. The automated sweep catches what a machine can catch and runs in
minutes. Testing with people who use assistive technology catches the rest,
and nothing replaces it. The sweep is set up and clean; the sessions below
have **not** been run, because they need real participants.

## 1. Automated sweep (run before every release)

```
BASE_URL=http://localhost:3000 A11Y_PASSWORD='<test account password>' npm run a11y
```

It signs in as each role in `scripts/a11y-pages.json`, opens every listed page
in the dark and light themes, runs axe-core against WCAG 2.0 and 2.1 levels A
and AA, and exits non-zero if anything fails. It needs a running app with a
test account for each role. Add a page to the JSON whenever you add a screen.

Also run `npx vitest run tests/designTokens.test.ts`. It fails if any
text-on-background colour pair the app depends on drops below 4.5:1 in either
theme, or if the documented tokens drift from `globals.css`.

What the sweep cannot see: whether a screen reader announces things in a
sensible order, whether instructions make sense, whether a flow is possible
without a mouse end to end, and anything that only appears after interaction
(open menus, validation messages, the exam timer). That is what the sessions
are for.

## 2. Sessions with assistive-technology users

**Who.** Five to eight people, paid for their time, covering at least:

| Technology | Why it matters here |
| --- | --- |
| NVDA or JAWS with Chrome or Edge on Windows | The most common setup for screen-reader users in Nigeria and across Africa |
| VoiceOver with Safari on iPhone | Many trainees use phones as their only device |
| TalkBack with Chrome on Android | Same, on the dominant phone platform |
| Keyboard only, or a switch device | Tests focus order, focus visibility and traps in dialogs |
| Screen magnification or 200% to 400% browser zoom | Tests reflow and clipping |
| Reduced motion and high contrast settings | Tests the global motion rule and forced colours |

Include people with low vision, people with dyslexia, and at least one person
for whom English is a second language: the exam instructions are dense.

**Format.** 45 minutes each, one at a time, on the participant's own device and
setup. Ask them to think aloud. Do not help unless they are stuck for more than
two minutes, and note when you did. Get consent to record audio and screen.

**Tasks.** Give the task, not the route.

Trainee
1. Create an account and sign in.
2. Find a course and start its first lesson.
3. Take a module assessment, with the timer running, and submit it.
4. Find out what the AI said about your last assessment and what to do next.
5. Find and share your certificate link.
6. Change a setting (notifications or dark mode).

Organization admin
1. Sign in and say how many seats are in use.
2. Invite a teammate.
3. Find out how many trainees finished a course and download that as a file.
4. Change the certificate design and remove the watermark line.

Staff
1. Find a trainee's exam result and read the AI analysis.
2. Revoke a certificate and confirm it is revoked.
3. Use the page search (Ctrl or Cmd K) to reach Settings.

Employer
1. Sign in, find a trainee, and send an introduction.
2. Post a vacancy.

## 3. What to record

For each problem: the task, the page, what happened, what they expected, the
technology, and a severity.

| Severity | Meaning |
| --- | --- |
| Blocker | The person could not complete the task |
| Serious | They completed it, but only with help or a workaround, or lost data |
| Moderate | Confusing or slow, but they recovered on their own |
| Minor | Noticed and mentioned, no effect on the task |

Fix every blocker before release, and every serious problem within the
following release. Re-run the automated sweep after fixes, then re-test the
failed task with the same participant where you can.

## 4. Known limits to check by hand

These are known weak spots no automated check covers:

- The exam timer: is the remaining time announced at sensible moments, and can
  it be paused or extended for someone who needs more time?
- Dialogs: focus trap and return of focus after closing, for every dialog type.
- The certificate editor canvas: it is a Fabric.js drawing surface, and it has
  not been checked for keyboard operation. Assume a person who cannot use a
  mouse cannot design a certificate there until a test shows otherwise, and
  that no non-visual alternative exists.
- Charts on the analytics and performance pages: check the figures are
  available as text or a table.
- The off state of the shared switch is a pale grey track. It has not been
  measured against the 3:1 minimum for non-text interface components.

// Terms and wording shared by both manuals.
exports.glossary = [
  ['AAICBI', 'Africa’s AI Capacity Building Initiative, organised by Futybills Tech Community. The AAICBI Ecosystem is the platform where learning, training organisations, employers, investors and startups meet.'],
  ['Account type', 'The kind of account you create: Trainee, Training Organisation, Employer, Investor or Startup founder. You choose it on the **Join** page.'],
  ['Alert / notification', 'A short message in the bell menu (and sometimes on your phone) that tells you something happened, such as a reply, a decision or a challenge.'],
  ['Arena (Ayakbi Arena)', 'The two-player question game and course chat. It only appears for a course when the AAICBI team has switched it on.'],
  ['Cohort', 'A group of trainees who study a course together. Cohorts are managed inside a course.'],
  ['Course (programme)', 'A set of modules and lessons, with assessments, that trainees enrol in.'],
  ['Dashboard', 'Your home page after signing in. It shows what needs your attention.'],
  ['Enrolment', 'A trainee’s place in a course. A trainee can only see the courses they are enrolled in.'],
  ['Fastest Fingers', 'A quick question an instructor posts in a course chat. The first correct answers earn credits.'],
  ['Feed', 'The public stream of posts from members and organisations.'],
  ['Game session / match', 'One game of Ayakbi Arena between two trainees.'],
  ['Gaming Studio', 'The platform’s tool for building games. It belongs to the AAICBI team only and is not available to training organisations or trainees.'],
  ['Handle', 'The short public address of a profile, such as `@your-name`.'],
  ['Leaderboard / ladder', 'A ranking of players in a course by their game results.'],
  ['Loop', 'The friendly guide character found on pages. Loop answers questions about using the platform and can take you to the right page.'],
  ['Moderation', 'Keeping play and chat fair: warning, restricting, removing messages or ending a game, always with a reason.'],
  ['Organisation role', 'What a team member may do in a training organisation: Owner, Manager, Editor or Viewer.'],
  ['Seat', 'A place in your organisation’s plan for one active trainee.'],
  ['Verification', 'Confirming your email address by opening the link in the message we send you.'],
];
exports.supportBody = (lib, audience) => lib.p('The pages this manual describes do not publish a support email address or phone number, so none is printed here. Use the in-platform options below.') + `<div class="placeholder">${lib.md('**Support contact — to be confirmed by AAICBI before distribution.** Insert the approved help email, phone or support page here.')}</div>` + lib.p('Until the contact details are confirmed, you can get help without leaving the platform:') + lib.bullets(['Open the round **Loop** button on any page and type your question. Loop knows the pages and can take you to the right one.', 'Use **Page Help** (bottom of the left menu on a computer) for help about the page you are on.', ...(audience === 'org' || audience === 'both' ? ['**Training organisations:** open **Settings** and use **Support → Message the Super Admin**: type a **Subject** and **Your message**. It goes straight to the AAICBI Super Admin’s inbox.'] : []), ...(audience === 'org' ? [] : ['**Trainees:** use **Messages** to write to your instructor or organisation about something in your course, and **Report a concern** (More menu) if something is wrong with a profile or person.'])]);

// Training organisation manual, chapters 1 to 3.
module.exports = (L) => {
  const { chapter, p, bullets, steps, task, tip, warn, note, pair, shot, table, h3, see } = L;
  const ch1 = chapter('o1', 1, 'Introduction to AAICBI',
    'This chapter explains what the AAICBI Ecosystem is and what a training organisation can do with it.',
    h3('What the AAICBI Ecosystem is') +
    p('The AAICBI Ecosystem is a web platform from Africa’s AI Capacity Building Initiative, organised by Futybills Tech Community. It brings together the people who make digital skills useful: **trainees** who learn, **training organisations** that teach, **employers** who hire, **investors** and **startups**. It runs in a normal web browser on a computer, tablet or phone and can be added to a phone’s home screen like an app.') +
    h3('What a training organisation can do') +
    bullets([
      'Create and run **courses** with modules, lessons, assessments, examinations and assignments.',
      'See which trainees are enrolled, how far they have got and how they scored (**Overview**, **Performance** and each course’s pages).',
      'Design and issue **certificates** with your own logo (**Certificates**).',
      'Present your organisation on a **public profile** and announce **events**.',
      'Invite **team members** and give each a role: Owner, Manager, Editor or Viewer.',
      'Write to trainees in **Messages** and post to the community **Feed**.',
      'See how trainees do in the educational **games** on your courses, keep play fair, and pass problems to the AAICBI team (**Games**).',
    ]) +
    h3('How you fit with trainees and the wider ecosystem') +
    p('You teach; trainees learn and their results stay with you. Trainees can find your public profile, follow you and message you. Employers and investors can browse training organisations and see the skills each programme teaches. You only ever see **your own** trainees, team and records — never another organisation’s.') +
    warn('Some tools belong to the AAICBI team and are **not** available to training organisations: the Gaming Studio and other platform-administration tools. This manual only describes what your account can do.') +
    h3('How this manual is organised') +
    p('Each chapter ends with the steps you need. Procedures always follow the same pattern — Task, Purpose, Before you begin, Steps, Expected result and If it does not work — so you can find what you need quickly. Numbered red circles on a screenshot match the numbers in the steps beside it. Where the phone looks different from a computer, both are shown.'));

  const ch2 = chapter('o2', 2, 'Getting Started',
    'How to create a training organisation account, wait for approval and sign in.',
    h3('Choosing the right account type', 'o2-type') +
    p('Open the AAICBI Ecosystem in your browser and select **Create account** (top right), or go to the **Join** page. It shows five cards: **Trainee**, **Training Organization**, **Employer**, **Investor** and **Startup**. Each card says who it is for, what it can do and what it asks for before you type anything.') +
    pair('shared/join-choose', {}, {}, 'The Join page lists the five account types. Choose **Training Organization** if you run training programmes.') +
    note('There is no staff or administrator option on the Join page. Staff accounts are created by the AAICBI team only.') +
    task({
      title: 'Create a training organisation account',
      purpose: 'Apply to run training programmes on AAICBI. Every organisation is reviewed before it can start.',
      before: 'Have your organisation’s name, your own name, a work email address you can read, and a password of your choice ready. A phone number and website are optional but help the review.',
      steps: [
        'On the **Join** page, select **Create a Training Organization account** on the Training Organization card. (You can also open `/org/register` directly.)',
        'Under **Your account**, fill in **Organization name**, **Your name**, **Work email** and **Password**.',
        'Under **How would you like to work with AAICBI?** choose **Revenue share** (no upfront cost; AAICBI takes a percentage of what your trainees pay you) or **Pay AAICBI directly** (a fixed platform fee; you keep 100% of what trainees pay you). Nothing is charged here — pricing is agreed with AAICBI after review.',
        'Optionally add a **Phone number** and **Organization website**. They strengthen the review but are not required.',
        'Select **Register**.',
      ],
      expected: 'The page changes to **Application received**: your account is pending review and you will be emailed once it is approved. You cannot sign in until then.',
      trouble: 'If a red message appears under the form, read it and correct the field it names (for example a missing required field or an email that is already registered). If it keeps failing, see {{ref:o12}}.',
    }) .replace('{{ref:o12}}', see('Chapter 12', 'o12')) +
    pair('org/register', {}, {}, 'The registration form. On a phone the form is split into three short steps (Your account, How you will work with us, Optional details); on a computer it is one page.') +
    tip('Use an email address that more than one person at your organisation can reach, for example a shared team address, so that the approval message is never missed.') +
    h3('After you apply: approval') +
    p('The AAICBI team reviews every organisation. When your account is approved you receive an email. Until then, trying to sign in shows: “Your account is still pending approval. We’ll email you once it’s reviewed.” This is expected and does not mean anything is wrong.') +
    task({
      title: 'Sign in',
      purpose: 'Open your organisation workspace.',
      before: 'Your organisation has been approved.',
      steps: [
        'Open `/org/login`, or choose **Sign in** from the **Join** page and pick the organisation option. The page is titled **Training Organization Sign In**.',
        'Enter your **Email** and **Password**.',
        'Select **Sign in**.',
      ],
      expected: 'You arrive in your organisation workspace. The left menu shows your name and your organisation with your role, for example “Northwind Academy · Owner”.',
      trouble: 'Read the message under the form: **Invalid email or password** means one of them is wrong (check Caps Lock); **Too many login attempts** means wait a few minutes before trying again; **pending approval** means the AAICBI team has not yet approved the account.',
    }) +
    pair('org/login', {}, {}, 'The Training Organization Sign In page.') +
    h3('If you cannot sign in', 'o2-recover') +
    bullets([
      'Check the email address and password carefully, then try again after a minute.',
      'If the page says your account is pending approval, wait for the approval email.',
      'If you are a team member rather than the owner, use the link in your invitation email to choose your own password first. Team members sign in with their own email and password.',
      'If you have forgotten your password, reset it yourself as described below.',
    ]) +
    task({
      title: 'Reset a forgotten password',
      purpose: 'Get back into your organisation account without waiting for anyone. It works for the owner and for every team member.',
      before: 'You can open the email inbox of the address you sign in with.',
      steps: [
        'On the **Training Organization Sign In** page select **Forgot your password?** (under the **Sign in** button).',
        'Type the **Email** you sign in with — the owner’s address or your own team address — and select **Send reset link**.',
        'Open the email from AAICBI and select **Reset Password**. The link works for one hour and only once.',
        'Type a **New password** (at least 8 characters) and select **Save new password**.',
        'Select **Go to sign in** and sign in with the new password.',
      ],
      expected: 'The page shows **Password changed**, and your old password no longer works.',
      trouble: 'The page always says “If an account exists for that email, we’ve sent a password reset link”, whether or not the address is registered — this protects your privacy. If no email arrives, check spam, check you typed the right address, and wait a few minutes. A disabled team member does not receive a link; ask an Owner or Manager. If the link says it is invalid or expired, select **Ask for a new link**.',
    }) +
    pair('org/forgot-password', {}, {}, 'Reset your organization password: enter your email, then follow the link we send.'));

  const ch3 = chapter('o3', 3, 'Understanding the Training Organisation Dashboard',
    'A tour of the left menu, the Overview page and the controls you will use every day.',
    h3('Two home pages: Dashboard and Overview') +
    p('After signing in you land in your workspace. The first item in the left menu, **Dashboard**, shows notifications, your recent activity, **Quick actions** (Create Examination, Courses, Performance, Trainees, Messages) and your examinations. The first item under **Organization**, **Overview**, is the page most organisation teams use every day: it answers “how is my cohort doing?” in one screen.') +
    pair('org/dashboard', {}, {}, 'Organization → Overview on a computer (left) and on a phone (right).') +
    h3('What is on the Overview page') +
    table(['Section', 'What it shows', 'Why it matters'], [
      ['**Active trainees**', 'How many trainees are active, out of the seats in your plan (for example “12 of 15 seats”).', 'Tells you how many places you have left before you need a larger plan.'],
      ['**Courses**', 'How many courses you have and how many are published.', 'A course must be published before trainees can enrol.'],
      ['**Certificates issued**', 'Certificates given to trainees that have not been revoked.', 'A quick measure of completed learning.'],
      ['**Completion**', 'Enrolments that are completed, as a percentage of all enrolments.', 'Shows whether trainees are finishing what they start.'],
      ['**Seat usage**', 'A bar showing seats used against seats available.', 'Warns you before you reach your limit.'],
      ['**Progress by course**', 'For each course: enrolled, completed and completion rate. Headings can be clicked to sort.', 'Shows which courses need attention.'],
      ['**Recent trainees**', 'The newest enrolments with their course, status (for example In progress or Completed) and date. Use the search box to find a trainee or course.', 'The fastest way to check on individual trainees.'],
    ]) +
    h3('The left menu on a computer', 'o3-menu') +
    p('The left menu is grouped. Groups open and close when you select their heading. At the top are your name and your role in your organisation, a **bell** for notifications, **Log out**, and a **Search pages** box (press **Ctrl + K**) that jumps to any page. **Page Help** at the bottom explains the page you are on.') +
    table(['Group and item', 'What you do there', 'Who may change things'], [
      ['**Dashboard**', 'Notifications, activity and quick actions.', 'Everyone'],
      ['**Feed** → Feed, Write a post, My posts', 'Read the community feed, publish posts as your organisation, and see the status of your posts.', 'Everyone who is signed in'],
      ['**Teaching** → Courses, Examinations, Assignments, Certificates', 'Build and manage learning content and the certificate trainees receive.', 'Owner and Manager; Editors build and edit but cannot publish, unpublish or delete'],
      ['**Organization** → Overview, Trainees, Team, Public profile, Education videos, Program skills, Content and visibility, Events, Member posts, Games', 'Run your organisation: people, public page, events, videos, posts about you, and game results and moderation.', 'Depends on the page; Viewers see everything and change nothing'],
      ['**Insight** → Performance, Growth report, Ads report, Messages', 'See how trainees are doing, campaign reports and your conversations.', 'Read mostly'],
      ['**Payments**', 'Payments for your programmes.', 'Depends on your role; billing belongs to the Owner'],
      ['**Settings**', 'Account and security settings.', 'Everyone for their own account'],
    ]) +
    p('Each organisation team member has a role, shown under their name in the menu:') +
    table(['Role', 'What they can do'], [
      ['**Owner**', 'Everything, including billing and the team.'],
      ['**Manager**', 'Everything except billing.'],
      ['**Editor**', 'Build and edit courses, examinations, assignments and posts. Cannot publish, unpublish, delete, change the public profile, billing or the team.'],
      ['**Viewer**', 'Look at everything; change nothing.'],
    ]) +
    tip('If a menu item you expect is missing, or a page says you do not have access, your role probably does not allow it. Ask an Owner or Manager. The platform always checks your role on the server, so hiding a button is never the only protection.') +
    h3('The menu on a phone', 'o3-mobile') +
    p('On a phone the left menu becomes a bar along the bottom with **Overview**, **Messages**, a round **Post** button, **Feed** and **More**. **More** opens the full list of pages. The page itself is rearranged into stacked cards (Alerts, Trainees, Messages) instead of tables. A **hamburger** button at the top right of the screen also opens the menu.') +
    pair('org/admin-dashboard', {}, {}, 'The Dashboard page on a computer and on a phone. On a phone the pages are shown as stacked cards and the menu moves to the bottom bar.') +
    h3('Controls that appear on every page') +
    bullets([
      '**Back** (top left) returns to the previous page.',
      'The **sun** at the top switches between light and dark appearance.',
      'The round **Loop** button (bottom right) opens the guide: type a question and Loop can take you to the right page.',
      '**Page Help** explains the page you are on.',
    ]));
  return [ch1, ch2, ch3];
};

// Training organisation manual, chapters 7 to 12.
module.exports = (L) => {
  const { chapter, p, bullets, task, tip, warn, note, pair, table, h3, see } = L;

  const ch7 = chapter('o7', 7, 'Managing Educational Games',
    'How to follow your trainees’ game results, watch live games and keep play fair on your own courses.',
    h3('Managing games is not developing games') +
    p('There are two different jobs around games. **Developing** games — building the questions, formats and rules of play for the whole platform — is done by the AAICBI team in a tool called the **Gaming Studio**. **Managing** games on your courses — seeing results, watching live games and keeping play fair — is what this chapter covers, and it is what your **Games** page is for.') +
    warn('Training organisations do **not** have access to the Gaming Studio or to platform-wide game settings. You will not see them in your menu. If you need a game changed or switched on, ask the AAICBI team.') +
    p('Games appear on a course only when the AAICBI team has switched them on for the platform and the course. The AAICBI team also decides, for each organisation, which of the abilities below your account may use. If a button or tab described here is missing or says “not switched on for your organization”, that ability is off for your account.') +
    h3('The Games page', 'o7-page') +
    p('Open **Organization → Games**. At the top, four counters summarise your courses: **Trainees**, **Games live now**, **Open reports** and **With AAICBI** (incidents you passed up). Six tabs sit underneath. Everything on this page is limited to **your own courses and trainees**.') +
    pair('org/games', {}, {}, 'The Games page. The tabs (1) switch between results, live games, moderation, group chat games, settings and history.') +
    table(['Tab', 'What it is for'], [
      ['**Results**', 'How trainees are doing in games and practice: players, answers and accuracy.'],
      ['**Live games**', 'Games being played right now by your trainees.'],
      ['**Moderation**', 'Open reports, restrictions, and your decisions.'],
      ['**Group chat games**', 'Fastest Fingers questions, challenges started in the chat and recent chat messages for one course.'],
      ['**Settings**', 'Switch supported games on or off for a course and set rules of play, within what the platform allows.'],
      ['**History**', 'Every moderation decision with its reason, who made it and when.'],
    ]) +
    h3('Seeing results and scores') +
    task({
      title: 'Review game results for a course',
      purpose: 'See who plays, how often and how well, so you can encourage the right people and spot problems.',
      steps: [
        'Open **Organization → Games**. The **Results** tab is shown first.',
        'Narrow the list with **Course**, **Cohort**, **Game**, **Trainee** (name or email) and **Date** (All time, Last 7 days, Last 30 days or Last 90 days).',
        'Read the summary line (for example “8 players · 96 answers · 70% right overall”) and the table beneath.',
        'Select a player’s row to open **latest answers** for that trainee.',
        'To keep a copy select **Download spreadsheet** (shown only if your organisation is allowed to export results).',
        'To see rankings open the **leaderboards for this course**: the **Ladder** and the **Fastest Fingers credits**.',
      ],
      expected: 'The table lists only your trainees. The filters change the numbers straight away.',
      trouble: 'An empty table with “No game activity for these filters yet” means nobody matching the filters has played yet; try **All time**. If **Download spreadsheet** is missing, export is not switched on for your organisation.',
    }) +
    pair('org/games', {}, {}, 'Results are the first tab. Use the filters, then open a player for their latest answers.') +
    h3('Watching live games and ending them') +
    task({
      title: 'See and end a live game',
      purpose: 'Stop a game that is being abused or was left open.',
      before: 'You can end sessions and your organisation’s policy allows it.',
      steps: [
        'Open the **Live games** tab. Each game shows the two players, the course, round, score and when it started. Warnings such as “Possibly abandoned” or “1 open report” appear beside it.',
        'Select **End session**. A box asks for a **Reason (kept with the decision)**.',
        'Type a clear reason of at least five characters and confirm.',
        'To remove one player instead, select **Remove** followed by the player’s name. The game ends for both players and the person removed is kept out of that course’s games for 24 hours unless you lift it.',
      ],
      expected: 'The game leaves the list and the decision, with your reason, appears in **History**.',
      trouble: 'If the tab says watching live games is not switched on, your account does not have that ability. Use **Refresh** to update the list.',
    }) +
    pair('org/games-live', {}, {}, 'Live games. Each row has **End session** and **Remove** controls.') +
    h3('Reviewing reports and moderating', 'o7-moderate') +
    p('Trainees can report cheating or abuse in a match. Reports for your courses appear on the **Moderation** tab under **Open reports**, each with the reason, who reported whom and when.') +
    task({
      title: 'Decide on a reported incident',
      purpose: 'Keep games fair, with every decision explained and recorded.',
      steps: [
        'Open the **Moderation** tab and read the report.',
        'Choose what to do: **Resolve** (the report was valid and is handled), **Dismiss** (no action needed), **Warn** followed by the trainee’s name, **Pause** the trainee **for 24 hours**, or **Escalate to AAICBI**.',
        'In the box that opens, write the **Reason (kept with the decision)** and confirm.',
      ],
      expected: 'The report leaves **Open reports**, any restriction appears under **Restrictions**, and the decision is listed in **History**.',
      trouble: 'A decision cannot be saved without a reason. If a button is missing, your role or your organisation’s policy does not allow it (see “Who can do what” below).',
    }) +
    pair('org/games-moderation', {}, {}, 'Moderation: open reports, active restrictions and the buttons for each decision.') +
    p('To end a restriction early select **Lift** beside the person under **Restrictions**. A lift also needs a reason.') +
    h3('Group chat games') +
    p('The **Group chat games** tab is for one course at a time. Choose the **Course**, then you can see the **Fastest Fingers games** (quick questions posted in the course chat; select **Stop this game** to close one), **Challenges started in the chat** and **Recent chat messages**. Select **Remove** beside a message that breaks the rules; removed messages are listed under **Recently removed** and the removal needs a reason.') +
    pair('org/games-chat', {}, {}, 'Group chat games for one course.') +
    h3('Escalating to the platform administrators') +
    p('Some cases are bigger than your team should settle alone, such as suspected cheating you cannot confirm. Select **Escalate to AAICBI** on a report and give the reason. A Super Admin on the AAICBI team is notified and decides. The incident stays in your **History** and the **With AAICBI** counter at the top of the page goes up until they close it.') +
    h3('Settings and history') +
    p('**Settings** lists each of your courses with the games and chat that are on for it. You can switch a supported game or the course chat **on** only where the platform setting already allows it, and you can always switch one **off**. You can also set the rules of play, such as **Seconds per question**. If your account is not allowed to change settings the tab says “Switching games on or off is not enabled for your organization.” **History** shows every moderation decision with its reason, who made it and when — your team’s record of fair play.') +
    pair('org/games-history', {}, {}, 'History: the permanent list of decisions and their reasons.') +
    h3('Older tools on each course page') +
    p('Each course page also contains the arena panels **Ayakbi Arena rules**, **Chat moderation**, **Fastest Fingers**, **Champion ladder**, **Live events** and **Game moderation**. They work on that one course and follow the same switches. The Games page is the single place that brings them together for all your courses.') +
    h3('Who can do what', 'o7-who') +
    table(['Team role', 'Games page'], [
      ['**Owner** and **Manager**', 'View results and live games, and moderate (warn, pause, end sessions, resolve or escalate), subject to your organisation’s policy.'],
      ['**Editor** and **Viewer**', 'View only.'],
    ]) +
    note('The AAICBI team can switch each ability on or off for your organisation (results, export, live monitoring, ending sessions, restricting trainees, removing players, chat game moderation, changing settings). A switched-off ability disappears from the page or is refused with a plain message.') +
    tip('Write reasons you would be comfortable showing the trainee. Reasons are kept with every decision.'));

  const ch8 = chapter('o8', 8, 'Communication and Community Features',
    'How to talk with trainees and the community, and how to handle behaviour that is not acceptable.',
    h3('Messages') +
    p('Open **Insight → Messages** (on a phone **Messages** is on the bottom bar). Conversations with trainees are listed; open one to read and reply. New messages appear in your bell and as a number on the Messages button. Only people you are allowed to talk to appear.') +
    pair('org/messages', {}, {}, 'Messages on a computer and on a phone.') +
    h3('Notifications') +
    p('The **bell** (top of the left menu; on a phone under **More** or at the top of Overview) lists alerts such as courses added to your organisation, replies and decisions. Select an alert to go to the page it is about, and use **See all** or **View All Notifications** for the full list.') +
    pair('org/notifications', {}, {}, 'Notifications.') +
    h3('Announcing events') +
    task({
      title: 'Announce an event',
      purpose: 'Tell visitors about open days, workshops and demo days on your public page.',
      steps: ['Open **Organization → Events**.', 'Fill in **Title** (required), **Starts (UTC)** and, if you wish, **Ends (UTC)**, **Place**, **Registration link** (a web address starting with https) and **Details**.', 'Select **Publish event**.'],
      expected: 'The event appears under the form and on your public page. To take it down select **Remove**.',
      trouble: 'Times are in UTC, so check the conversion for your location. A registration link must start with https.',
    }) +
    pair('org/events', {}, {}, 'Events. Visitors register on your own link; nothing is collected on the platform.') +
    h3('Posting to the community feed') +
    p('Open **Feed → Write a post** to share an update as your organisation: a title (optional), your text, up to six images or a YouTube link. Posts are checked automatically; a clean post is published straight away, and anything that needs a second look is held for the review team. **Feed → My posts** shows each post’s status and lets you edit, withdraw or delete it.') +
    pair('org/compose', {}, {}, 'Write a post.') +
    h3('Member posts about your organisation', 'o8-posts') +
    p('**Organization → Member posts** lists posts by trainees that mention your organisation and that the AAICBI team has already published. If one does not suit your organisation you can **Hide from the public**; you must give a reason, the trainee reads it and can appeal to the central team. This keeps your public page safe without silently removing anyone’s work.') +
    pair('org/posts', {}, {}, 'Member posts.') +
    h3('Group chats and game behaviour') +
    p('Course group chats belong to trainees and their courses. You do not read private direct messages between trainees. For chat inside the games, use the **Group chat games** tab (Chapter 7) to see recent messages, remove messages that break the rules and restrict a player, always with a reason.') +
    h3('Reporting inappropriate behaviour') +
    bullets([
      'In a game or its chat: use **Moderation** on the Games page; escalate to AAICBI if needed.',
      'A member post about your organisation: **Hide from the public** with a reason.',
      'Anything else — a profile, a person, a message: tell the AAICBI team using Messages or your support contact (see **Getting help**).',
    ]));

  const ch9 = chapter('o9', 9, 'Search, Discovery, and Public Visibility',
    'How people find you, how you find others, and what you control about what the public sees.',
    h3('Searching the ecosystem') +
    p('The search box at the top of every public page (and **Search pages** in your menu for pages inside your workspace) finds people, organisations, employers, investors, startups, jobs, programmes, posts, comments, videos and events. Type a word and select **Search**, then narrow with the buttons **All, People, Organizations, Employers, Investors, Startups, Jobs, Programs, Posts, Comments, Videos, Events**.') +
    pair('shared/search', {}, {}, 'Search results for “data”: organisations, jobs and programmes appear in groups.') +
    h3('The home feed and public pages') +
    p('The home page is the public feed, with links to **Organizations**, **Trainees**, **Jobs**, **Startups**, **Learn** and **Events**. Visitors can read much of it without an account; creating posts, following and messaging need one.') +
    pair('shared/home-feed', {}, {}, 'The public home page and feed.') +
    h3('What affects your public visibility') +
    table(['What you change', 'Where', 'Effect'], [
      ['Show or hide your public page', '**Organization → Public profile** → **Show my organization page publicly**', 'Controls whether visitors can see your page at all.'],
      ['Tagline, location, logo, cover, About', '**Organization → Public profile**', 'What appears on your page, search and cards.'],
      ['Skills each programme teaches', '**Organization → Program skills**', 'Lets people who watch a video about a skill be shown your matching programmes.'],
      ['Events', '**Organization → Events**', 'Shown on your public page.'],
      ['Trainee videos', '**Organization → Education videos**', 'Videos presented by trainees, published only after the trainee agrees and the AAICBI team reviews them.'],
      ['Posts', '**Feed → Write a post**', 'Appear in the feed under your organisation’s name.'],
    ]) +
    h3('Publishing a trainee education video') +
    task({
      title: 'Ask a trainee to present a video',
      purpose: 'Show your trainees’ work publicly, with their agreement.',
      steps: ['Open **Organization → Education videos**.', 'Choose the **Trainee** (only trainees enrolled in your programmes are listed).', 'Paste the **YouTube link** and select **Check link**.', 'Fill in **Video title**, and if you wish **Description**, **Program**, **Module** and **Skills**.', 'Select **Send for trainee consent**.'],
      expected: 'The trainee is asked to agree. Nothing is public until they agree and the AAICBI team has reviewed the video.',
      trouble: 'If **Check link** rejects the address, make sure it is a normal YouTube link.',
    }) +
    pair('org/education', {}, {}, 'Publish trainee education: consent comes first.') +
    note('Employers and investors can browse training organisations and see the skills each programme teaches. The platform does not let an organisation contact them from this manual’s pages; they reach you through your public page and Messages.'));

  const ch10 = chapter('o10', 10, 'Reports, Analytics, and Monitoring',
    'What each number means and how it can guide your training decisions.',
    h3('Organization → Overview') +
    p('Your starting point. **Active trainees** and **Seat usage** show how full your plan is; **Courses** shows how many are published; **Certificates issued** counts certificates not revoked; **Completion** is completed enrolments as a share of all enrolments. **Progress by course** shows, for each course, how many enrolled, how many completed and the rate. Use it to see which course needs attention first.') +
    h3('Insight → Performance') +
    p('Choose a course to see **Trainee Performance**. Cards show **Total trainees**, **Avg. completion**, **Avg. assessment score**, **At risk** and **Certification rate**. The table lists each trainee with their progress, first, best, latest and average scores, attempts, modules passed, trend, certification and status (for example **On Track**). Filter by cohort or module and search by name. Select **Export CSV** or **Export PDF** to keep a copy.') +
    pair('org/performance-course', {}, {}, 'Trainee Performance for a course, with filters and exports.') +
    table(['Indicator', 'What it means', 'What to do with it'], [
      ['**Avg. completion**', 'On average, how much of the course trainees have finished.', 'A low number early on is normal; a low number late suggests the course is too long or support is needed.'],
      ['**Avg. assessment score**', 'The average score on module assessments.', 'A low average on one module often means the lessons for it need work.'],
      ['**At risk**', 'Trainees who crossed an inactivity or failed-attempts threshold.', 'Message them early (see **Early Warnings**).'],
      ['**Certification rate**', 'Share of trainees who earned a certificate.', 'Compare courses to see where trainees get stuck.'],
      ['**Trend**', 'Whether a trainee’s scores are rising or falling.', 'Encourage rising trainees; check on falling ones.'],
    ]) +
    h3('Course reports and other pages') +
    bullets([
      '**Early Warnings** (in each course): trainees who passed the inactivity or failed-attempts thresholds you set.',
      '**Certificates Issued** (in each course): certificates earned.',
      '**Games → Results**: game and practice results with accuracy; **Download spreadsheet** when allowed (Chapter 7).',
      '**Organization → Content and visibility**: for the last 30 days, **Page visits**, **Video views**, **Program clicks**, **New followers**, **Likes and saves** and **New enrollments**, plus your most-watched videos. The counts are anonymous.',
      '**Insight → Growth report** and **Insight → Ads report**: campaign reports from the AAICBI team’s growth and advertising tools. Where they show data they cover the free taster game and any ads booked for your organisation.',
    ]) +
    pair('org/insights', {}, {}, 'Content and visibility: anonymous counts of how your public content is seen.') +
    note('Reports show what the platform has recorded. A new course with no activity shows empty states or zeros. The numbers update as trainees learn.') +
    h3('Exports') +
    bullets(['Performance: **Export CSV** and **Export PDF**.', 'Game results: **Download spreadsheet**, only when the AAICBI team has allowed exports for your organisation.', 'Take care of exported files: they contain trainees’ names and results.']));

  const ch11 = chapter('o11', 11, 'Account Settings and Security',
    'Keep your account and your trainees’ information safe.',
    h3('Your account') +
    p('Open **Settings** (bottom of the left menu, or **More → Settings** on a phone). The **Account** page has your **Profile Picture** (**Upload**, JPG/PNG/WEBP up to 5 MB), **Change password** and **Dark Mode**. Under **Support**, **Message the Super Admin** lets you send a **Subject** and **Your message** straight to the AAICBI Super Admin’s inbox — the in-platform way to ask for help. Your name and role are shown at the top of the left menu. Team members each have their own sign-in, and what each person changes is recorded under their own name in **Organization → Team → Recent activity** (visible to Owners and Managers).') +
    pair('org/settings', {}, {}, 'Settings: profile picture, change password, dark mode and support.') +
    task({
      title: 'Change your password',
      purpose: 'Keep your account safe, for example after sharing a computer or if you think someone knows your password.',
      before: 'You are signed in and you know your current password. (If you have forgotten it, use **Forgot your password?** on the sign-in page instead.) Every team member, whatever their role, can change their own password.',
      steps: ['Open **Settings**.', 'In **Change password** type your **Current password**.', 'Type the **New password** (at least 8 characters) and type it again under **New password again**.', 'Select **Change password**.'],
      expected: 'A message says your password has been changed. Use the new one next time you sign in.',
      trouble: '“Your current password is not right” means the first box is wrong. “The two new passwords do not match” means the second and third boxes differ. After several wrong attempts you must wait a few minutes.',
    }) +
    h3('Managing your team safely') +
    task({
      title: 'Invite a team member',
      before: 'You are an Owner or Manager.',
      steps: ['Open **Organization → Team**.', 'Under **Invite a teammate** enter **Name**, **Email** and choose a **Role**: Editor (the default), Manager or Viewer.', 'Select **Send invitation**.'],
      expected: 'The person receives an email with a link to choose their own password. They then sign in as themselves.',
      trouble: 'To change someone’s role, or to disable or remove them, use the controls under **Teammates**. Disabling or demoting takes effect on their next request.',
    }) +
    pair('org/team', {}, {}, 'Team: invite people, set roles and review recent activity.') +
    h3('Protecting your credentials') +
    bullets(['Use a long password that you do not use anywhere else.', 'Never share your password. Give colleagues their own invitation instead.', 'Sign out on shared computers with **Log out** (top of the left menu; on a phone under **More**).', 'Be careful with exported files that contain trainee names.', 'Only sign in on the real AAICBI address, and be suspicious of messages that ask you to confirm your password.']) +
    h3('Recognising suspicious activity') +
    bullets(['**Team → Recent activity** shows changes you did not expect.', 'A teammate you did not invite.', 'Alerts about courses, payments or trainees you do not recognise.', 'If you notice anything like this, change what you can, remove the person in **Team** and contact AAICBI at once (see **Getting help**).']) +
    h3('Logging out safely') +
    p('Select **Log out** at the top of the left menu. On a phone open **More** and choose **Log out**. Close the browser tab afterwards on a shared device.') +
    h3('Role-based access') +
    p('What you see depends on your role (Chapter 3) and on what the AAICBI team has switched on for your organisation. If something is missing, that is by design, not a fault. The platform checks your permissions on the server for every action, so it is never enough to hide a button.'));

  const ch12 = chapter('o12', 12, 'Troubleshooting and Frequently Asked Questions',
    'Safe things to try first, and when to contact support.',
    table(['Problem', 'Try this', 'If it persists'], [
      ['**I cannot sign in**', 'Check the email and password. Wait a few minutes if you see “Too many login attempts”. If you see “pending approval”, wait for the approval email.', 'Contact AAICBI support.'],
      ['**I forgot my password**', 'On the sign-in page select **Forgot your password?**, enter your email and follow the link we send (it works for one hour). This works for owners and team members.', 'Check spam; a disabled team member gets no link, so ask an Owner or Manager to check **Team**.'],
      ['**A dashboard feature is missing**', 'Check your role (shown under your name). Editors and Viewers see fewer controls. Some tools are for the AAICBI team only.', 'Ask an Owner to review your role.'],
      ['**I cannot open a page or action**', 'You may not have that permission, or the ability may be switched off for your organisation.', 'Ask an Owner; for games, ask AAICBI.'],
      ['**Trainees are missing from a list**', 'Open **Organization → Trainees** and search by name or email. Check they are enrolled in one of **your** courses (a course’s **Enrollments** page). Clear the filters on Performance.', 'Check the course is published and has seats.'],
      ['**A course or enrolment looks wrong**', 'Open the course’s **Enrollments** page: check the status, **Extend Access** or **Revoke**.', 'Contact AAICBI.'],
      ['**Game results are not showing**', 'Try **All time**, clear the filters and check the right course is chosen. Games only count after trainees have played.', 'The games may not be switched on for the course; ask AAICBI.'],
      ['**Chat or game problems**', 'Use **Refresh** on **Live games**. Check **Restrictions** in case a trainee is paused.', 'Escalate to AAICBI.'],
      ['**The page looks wrong on a phone**', 'Rotate the phone, refresh, and try the **More** menu. Long pages such as the course page scroll down.', 'For complex tasks use a computer; the platform recommends it for course building.'],
      ['**Slow loading**', 'Move to a stronger connection, close other tabs and refresh. The platform keeps pages light for slow connections.', 'Try again later.'],
    ]) +
    h3('Frequently asked questions') +
    p('**Can I see another organisation’s trainees?** No. You only ever see your own.') +
    p('**Can I use the Gaming Studio?** No. It belongs to the AAICBI team. You manage results and moderation on the **Games** page.') +
    p('**Can I give a trainee access to a paid course?** Yes, from the course’s **Enrollments** page with **Grant Access**.') +
    p('**Who sees my public page?** Anyone, if **Show my organization page publicly** is on and the AAICBI team has switched public pages on.') +
    p('**Where do I report a problem?** See **Getting help** at the end of this manual.'));

  return [ch7, ch8, ch9, ch10, ch11, ch12];
};

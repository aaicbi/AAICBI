// Trainee manual, chapters 9 to 12, plus the assembled part.
module.exports = (L) => {
  const { chapter, p, bullets, task, tip, warn, note, pair, table, h3 } = L;

  const ch9 = chapter('t9', 9, 'Understanding Your Results and Progress',
    'Where to see how you are doing, and how to use feedback to improve.',
    h3('My Progress') +
    p('Open **My Progress**. It shows what the platform’s AI sees across your assessments and what to do next: your **Recent average** (last five assessments), your **Latest score** and how it compares with your earlier average, and how many **Assessments analysed**. **Where you are strong** and **Focus next** name topics. The **AI review of your latest assessment** gives short written feedback. **Your courses** shows a progress bar for each course.') +
    pair('trainee/progress', {}, {}, 'My Progress: strengths, what to focus on next and progress in each course.') +
    h3('Analytics & Reports') +
    p('**Analytics & Reports** shows your activity: **Courses started**, **Courses completed**, **Lessons completed**, **Assessments completed** and your **Current streak** of days. **Assessment Performance** lists how many you passed and failed, your average and highest score. **Your Interests** lists topics you spend time on. Select **Download My Report (PDF)** for a copy.') +
    pair('trainee/activity', {}, {}, 'Analytics & Reports.') +
    h3('Examination results and certificates') +
    bullets(['**Examinations**: each row shows your status and **View result** for completed ones.', '**Certificates**: certificates you earned, with a verification link anyone can use.', 'Game scores and ladder position are in **Ayakbi Arena** (Chapter 8).']) +
    h3('Using feedback to improve') +
    bullets(['Read the explanation for every question you miss, not only the score.', 'Start with the topic named under **Focus next**.', 'Use **Practice** for that topic before retaking an assessment.', 'Ask a question in the lesson **Q&A** or message your instructor.', 'A score that goes up and down is normal; look at the trend, not one result.']));

  const ch10 = chapter('t10', 10, 'Using the Feed and Social Features',
    'The feed is where members and organisations share what they learn and build.',
    h3('Reading the feed') +
    p('Open **Feed**. Posts appear under **Latest**, **Following** and **Discover**. Select a post to read it, like or save it and comment. People you follow appear under **Following**. **Saved** posts are kept for later.') +
    pair('trainee/feed', {}, {}, 'The feed.') +
    h3('Writing a post') +
    task({
      title: 'Share something you learned or built',
      steps: ['Open **Write a post** (or the round **Post** button on a phone).', 'Add a **Title** if you like and write your text. Use #topics so people can find it.', 'Optionally add up to six images, or one YouTube link (a post has either a video or images, not both).', 'Choose **Who can see it**.', 'Select **Submit for review** or **Save draft**.'],
      expected: 'Your post is checked automatically. If it looks fine it is published straight away; if it needs a second look the review team checks it first. **My posts** shows the status.',
      trouble: 'A post that needs changes is returned with a reason in **My posts**; edit it and send it again.',
    }) +
    pair('trainee/compose', {}, {}, 'Write a post.') +
    h3('Community standards') +
    bullets(['Be respectful; no harassment, hate or threats.', 'Share your own work or give credit.', 'Do not post private details about yourself or others.', 'Training organisations can ask for a post that mentions them to be kept off the public feed (with a reason you can read and appeal).']) +
    h3('Discovering members') +
    p('Search for **People**, open a profile and follow them. Profiles show what the person chose to share.'));

  const ch11 = chapter('t11', 11, 'Notifications, Messages, and Account Settings',
    'Stay informed, stay in touch and look after your account.',
    h3('Notifications') +
    p('The **bell** lists alerts; open **Notifications** for the full list. A red number shows what is new. You can allow notifications on your phone from **Settings** so important alerts, such as game challenges, reach you even when the app is closed. On an iPhone, add AAICBI to the Home Screen first.') +
    pair('trainee/notifications', {}, {}, 'Notifications.') +
    h3('Messages') +
    p('Open **Messages** for conversations with instructors and organisations, and use the round Messages button for your course chats too. Employers may also write to you after an introduction you accept.') +
    h3('Settings') +
    pair('trainee/settings', {}, {}, 'Settings.') +
    table(['Setting', 'What it does'], [
      ['**Profile Picture** (Your account)', 'Select **Upload** (JPG, PNG or WEBP up to 5 MB; you can drag and zoom to place it).'],
      ['**Progress notifications** (Notifications)', 'A switch: email me when I unlock the next module and when an assessment result is ready.'],
      ['**Low-bandwidth mode**', 'Lighter pages for slow connections.'],
      ['**AI study buddy**', 'Switch Loop’s study help on or off.'],
      ['**Dark mode**', 'Switch to a dark appearance. It follows you across devices.'],
      ['**WhatsApp Notifications**', 'Verify a WhatsApp number with a 6-digit code to receive key updates.'],
      ['**Employer Discoverability**', 'A switch (with **Save**) that lets vetted employers browsing AAICBI find you. Your contact details stay hidden until you accept a specific introduction.'],
      ['**Public Profile Link**', 'Select **Generate Link** to make a shareable link to your profile, useful on a résumé or LinkedIn. It only works while Employer Discoverability is on.'],
    ]) +
    h3('Passwords and logging out') +
    bullets(['To set a new password, select **Forgot your password?** on the sign-in page and follow the email link. The settings page has no separate “change password” box.', 'Never share your password. AAICBI will never ask for it.', 'To log out select **Log out** at the top of the menu (on a phone open **More**). Always log out on shared computers.']) +
    h3('Account security advice') +
    bullets(['Use a password you do not use anywhere else.', 'Be careful with links in messages; open AAICBI by typing its address.', 'Review your profile visibility from time to time.', 'If you think someone else used your account, reset your password and tell your organisation.']));

  const ch12 = chapter('t12', 12, 'Troubleshooting and Frequently Asked Questions',
    'Simple fixes for common problems.',
    table(['Problem', 'Try this'], [
      ['**I cannot register**', 'Read the red message under the form. Make sure the Privacy Policy box is ticked and your password has at least 8 characters. An email that is already registered cannot be used again — sign in instead.'],
      ['**I cannot sign in**', 'Check your email and password (Caps Lock). If you never verified your email, use **Send the link again** on the sign-in page. Wait a few minutes after too many attempts.'],
      ['**I forgot my password**', 'Select **Forgot your password?** under the sign-in form and follow the email link.'],
      ['**A course is missing**', 'Open **Courses**: only published courses appear. If your organisation arranged access, check the email address they used matches yours.'],
      ['**Learning materials are missing**', 'Some modules unlock after the previous one. Refresh the page. Ask your instructor if a lesson is empty.'],
      ['**I cannot send a message**', 'Check your connection. In a course chat you may be paused by a moderator; the page says why.'],
      ['**I cannot join a group chat**', 'The chat appears only for courses where it is switched on and only if you are enrolled.'],
      ['**A game will not connect**', 'Refresh and reopen **Ayakbi Arena**. Check your connection.'],
      ['**A score is missing or looks wrong**', 'Games and assessments appear after you finish. Message your instructor with the date and the game or assessment name.'],
      ['**The phone menu is confusing**', 'Use the bottom bar and **More**. **Back** at the top left returns to the previous page. The **Loop** button can take you to any page.'],
      ['**Pages are slow**', 'Turn on **Low-bandwidth mode** in **Settings**, refresh, and try a stronger connection.'],
    ]) +
    h3('Frequently asked questions') +
    p('**Is it free?** Some courses are free and some are paid. The course card shows **FREE** or **PAID**.') +
    p('**Who can see my profile?** You choose under **Profile visibility**.') +
    p('**Can I use it on my phone?** Yes. You can also add it to your home screen.') +
    h3('Seeking help') +
    p('Ask **Loop**, use **Page Help**, message your instructor or organisation, or use **Report a concern** for something wrong with a profile or person. For account problems, see **Getting help** at the end of this manual.'));

  return [ch9, ch10, ch11, ch12];
};

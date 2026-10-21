// Trainee manual, chapters 1 to 4.
module.exports = (L) => {
  const { chapter, p, bullets, steps, task, tip, warn, note, pair, shot, table, h3, see } = L;
  const ch1 = chapter('t1', 1, 'Welcome to AAICBI',
    'This guide helps you create an account, find your way around and make the most of your learning.',
    h3('What the AAICBI Ecosystem is') +
    p('The AAICBI Ecosystem is a learning and opportunity platform from Africa’s AI Capacity Building Initiative, organised by Futybills Tech Community. Training organisations teach courses on it. Employers, investors and startups use it to find talent and ideas. You use it to **learn**, to **practise**, to **connect** with other learners and to **build a profile** that others can find.') +
    h3('What you can do after creating an account') +
    bullets([
      'Study **courses** you are enrolled in, with lessons, practice and assessments.',
      'Take **examinations** and **assignments** and read your results and feedback.',
      'Earn **certificates** that anyone can verify.',
      'Play educational **games** and, where your course allows it, challenge a coursemate in the **Ayakbi Arena**.',
      'Chat with coursemates in the **course chat** and send **messages** to instructors and organisations.',
      'Complete a **profile** with your skills, education and projects, and choose who can see it.',
      'Read and write posts in the community **Feed**, and explore organisations, jobs and events.',
      'Ask **Loop**, the friendly guide, how anything works.',
    ]) +
    h3('Using the platform responsibly') +
    bullets([
      'Be kind and respectful in chats and posts. Moderators can remove messages and limit play when rules are broken.',
      'Keep your password private. Never share it, not even with someone who says they work for AAICBI.',
      'Share personal details carefully. Your profile can be public — see Chapter 4.',
      'Do your own work in examinations and assignments.',
    ]) +
    tip('You can use AAICBI on a computer, tablet or phone. This manual shows the computer and the phone side by side wherever they differ.'));

  const ch2 = chapter('t2', 2, 'Creating Your Account',
    'Choose the Trainee account, fill in the form, confirm your email and sign in.',
    task({
      title: 'Choose the Trainee account type',
      purpose: 'Each kind of person has their own sign-up. The Trainee account is for people who learn.',
      steps: [
        'Open the AAICBI Ecosystem in your browser.',
        'Select **Create account** at the top right of the page (or open the **Join** page).',
        'Find the **Trainee** card (the first card) and select **Create a Trainee account**.',
      ],
      expected: 'The **Create Your Account** page opens.',
    }) +
    pair('shared/join-choose', {}, {}, 'The Join page. Choose **Trainee** if you are a learner. The other cards are for training organisations, employers, investors and startup founders.') +
    task({
      title: 'Fill in the registration form',
      before: 'You need an email address you can open right now, and a password of at least 8 characters.',
      steps: [
        'Type your **Full name**.',
        'Type your **Email**.',
        'Choose a **Password** (at least 8 characters).',
        'If you see **Start a free course now? (optional)**, pick a free course or leave it on **Not right now**.',
        'Read the **Privacy Policy** (the link opens it) and tick the box **I have read and agree to AAICBI’s Privacy Policy**. The **Create account** button stays grey until you do.',
        'Select **Create account**.',
      ],
      expected: 'A **Check your email** page tells you a verification link has been sent.',
      trouble: 'A red message under the form explains what to fix (for example an email that is already registered). If the button does not respond, make sure the Privacy Policy box is ticked. You can also choose **Sign up with Google** if that button is shown.',
    }) +
    pair('trainee/register', {}, {}, 'The trainee registration form.') +
    task({
      title: 'Verify your email and sign in for the first time',
      purpose: 'Verification proves the address is yours and activates your account.',
      steps: [
        'Open your email inbox and find the message from AAICBI.',
        'Open the verification link in the message. A page confirms **Email Verified**.',
        'Select **Sign in** (or open the trainee sign-in page).',
        'Enter your **Email** and **Password** and select **Sign in**.',
      ],
      expected: 'You arrive on your trainee dashboard.',
      trouble: 'No email? Check your spam or junk folder. Right after you register you are taken to the sign-in page, which shows **Your account is created. Verify your email to finish.** with a **Send the link again** button — select it. If **Verification Failed** appears the link may have expired; use **Send the link again**. Still stuck? See Chapter 12.',
    }) +
    pair('trainee/login', {}, {}, 'The trainee sign-in page. **Forgot your password?** is under the form.') +
    warn('Use only the real AAICBI address in your browser, and never type your password into a page you reached from an unexpected message.'));
  const ch3 = chapter('t3', 3, 'Exploring the Trainee Dashboard',
    'Your dashboard is the first page you see after signing in. It shows what to do next.',
    h3('What is on your dashboard') +
    pair('trainee/dashboard', {}, {}, 'The trainee dashboard on a computer (left) and on a phone (right).') +
    table(['Part of the page', 'What it shows', 'What you can do'], [
      ['**Chat is live** cards', 'A course group chat with new messages, with a short preview and a count such as “4 new”.', 'Select **Open chat** to read and reply, or **Later** to dismiss the card for now.'],
      ['**Continue learning** / course card', 'The course you were studying, a progress bar such as “1 of 1 module complete”, and a tag such as **PAID** or **FREE**.', 'Select **Resume** to continue where you stopped.'],
      ['**Your examinations**', 'How many examinations are **Available**, **In progress** and **Passed**.', 'Select **View all** to open the full list.'],
      ['**Notifications**', 'Your latest alerts and a count of new ones.', 'Select an alert to go to the page it is about, or **View All Notifications**.'],
      ['**Your certificates**', 'Certificates you have earned.', 'Open one to download or share it.'],
      ['**Also in progress**', 'Other courses you have started.', 'Select a course to continue.'],
    ]) +
    h3('The left menu on a computer') +
    table(['Menu item', 'What it opens'], [
      ['**Dashboard**', 'This page.'],
      ['**Courses**', 'The courses you are enrolled in (Chapter 6).'],
      ['**Ayakbi Arena**', 'Challenge a coursemate and join the course chat, where it is switched on (Chapters 7 and 8).'],
      ['**Feed**, **Write a post**, **My posts**', 'The community feed and your own posts (Chapter 10).'],
      ['**Examinations**', 'Your examinations and results.'],
      ['**Assignments**', 'Written work from your instructors.'],
      ['**Certificates**', 'Certificates you earned.'],
      ['**My Progress**', 'How far you are in each course and what to work on next.'],
      ['**Analytics & Reports**', 'Your learning activity over time.'],
      ['**Messages**', 'Conversations with instructors and organisations.'],
      ['**Page Help**', 'Help for the page you are on.'],
    ]) +
    p('At the top of the menu are your name and **Trainee**, the **bell** for notifications, **Log out** and **Search pages** (press **Ctrl + K**). Some further pages are reached from other places: **Explore**, **My profile**, **Settings**, **Job board**, **My videos**, **Introductions**, **My startups** and **Report a concern**.') +
    h3('Using the dashboard on a phone', 't3-mobile') +
    p('On a phone the left menu becomes a bar at the bottom of the screen with your most-used items and a **More** button that opens everything else. The bell and **Log out** are in the top area. Tables become stacked cards, and the **Post** button is a round button in the middle of the bar.') +
    task({
      title: 'Open your dashboard from anywhere',
      steps: ['Open the AAICBI Ecosystem and sign in.', 'On a computer select **Dashboard** at the top of the left menu. On a phone choose the first button of the bottom bar.', 'Use **Back** (top left of the page) to return to the previous page at any time.'],
      expected: 'Your name, your courses and your notifications appear.',
    }) +
    h3('Notifications and activity indicators') +
    p('A red number on the **bell** (and on the **Messages** button) shows new items. Selecting the bell lists alerts such as challenges, replies, decisions and course updates. Reading them clears the number. If you allow phone notifications, the same alerts reach your phone even when AAICBI is closed.') +
    tip('The round **Loop** button at the bottom right opens a guide. Ask it a question such as “where are my certificates?” and it can take you there.'));

  const ch4 = chapter('t4', 4, 'Completing Your Profile',
    'Your profile is how organisations, employers and other members get to know you. You decide who can see it.',
    h3('What your profile contains') +
    table(['Part', 'What to add'], [
      ['**Name, photo and handle**', 'Your name, a profile picture and your **Username (your handle)**, which becomes your public address, for example `@your-name`.'],
      ['**Details**', '**Location**, **LinkedIn**, **GitHub**, **Portfolio website**, **Current employment status** and an **Open to work** switch.'],
      ['**Skills**', 'Add a skill (for example Python) and choose a **Skill level**.'],
      ['**Education**', '**Institution**, **Field of study**, **Credential** and dates.'],
      ['**Work experience**', '**Job title**, **Employer**, **Description** and dates.'],
      ['**Projects**', '**Project title**, **Description**, a **Link**, and an option to **List in Community Showcase**.'],
      ['**Profile visibility**', 'Who may see your profile.'],
    ]) +
    task({
      title: 'Edit your profile',
      steps: ['Open **My profile** (from **More** on a phone, or from the account menu on a computer).', 'Update your details and select the save button of each section.', 'To add a skill type it under **Add a skill**, choose a **Skill level** and add it.', 'To add education, experience or a project use the **Add** button of that section.'],
      expected: 'The new information appears on your profile straight away.',
      trouble: 'If a handle is refused it may already be taken or contain characters that are not allowed; try another.',
    }) +
    pair('trainee/profile', {}, {}, 'My profile.') +
    task({
      title: 'Upload a profile picture',
      steps: ['Open **Settings**.', 'Find **Profile Picture**.', 'Choose a picture from your device and confirm.'],
      expected: 'Your picture shows next to your name across the platform.',
    }) +
    h3('Choosing who can see your profile') +
    p('Under **Profile visibility** choose who may see your profile: **Public**, signed-in members only, employers only or **Private**. A new account starts as **Public** so that people can find you. You can change this at any time.') +
    warn('Think before you share. Do not put your home address, phone number, passwords, identity-document numbers or bank details in your profile, posts or chats.') +
    h3('Keeping personal information safe') +
    bullets(['Share only what you are comfortable with strangers seeing if your profile is public.', 'Use **Private** or **employers only** if you prefer.', 'Never share your password with anyone.', 'Use **Report a concern** if someone asks you for private information.']) +
    p('In **Settings** you can also turn on **Employer discoverability** (let employers find you, with a headline and certificates you choose), see your **Public Profile Link**, and set **Low-bandwidth mode**.'));
  return [ch1, ch2, ch3, ch4];
};

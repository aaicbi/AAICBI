// Training organisation manual, chapter 4 onward (profile, trainees, courses).
module.exports = (L) => {
  const { chapter, p, bullets, steps, task, tip, warn, note, pair, shot, table, h3, h4, see } = L;
  const ch4 = chapter('o4', 4, 'Setting Up the Organisation Profile',
    'Your public profile is what visitors, trainees, employers and investors see about your organisation. Everything you enter on this page can become public, so write it for visitors.',
    h3('What the profile contains') +
    table(['Field', 'What to enter', 'Notes'], [
      ['**Show my organization page publicly**', 'A switch. When it is on, your page can be seen by visitors.', 'Off by default. Your page also needs the platform’s public pages to be switched on by AAICBI.'],
      ['**Page address**', 'The short name in your page’s web address, for example `northwind-academy`.', 'Required. Shown under the field as the full address of your page.'],
      ['**Tagline**', 'One line about what you do, for example “Practical data skills”.', 'Shown in search results and on cards.'],
      ['**Location**', 'Your city or country.', 'Optional.'],
      ['**Organization picture**', 'Your logo or profile picture.', 'JPG, PNG or WEBP, up to 5 MB. Shown on your page, your profile, search and the feed. You can drag and zoom the picture before it is added.'],
      ['**Cover picture**', 'A wide picture across the top of your page.', 'JPG, PNG or WEBP, up to 5 MB. You can drag and zoom to place it.'],
      ['**About**', 'A short description of your organisation and training.', 'Only the fields on this page are ever shown publicly.'],
    ]) +
    task({
      title: 'Edit your public profile',
      purpose: 'Present your organisation clearly so the right trainees and partners find you.',
      before: 'You are signed in as an Owner or Manager. Editors and Viewers cannot change the public profile.',
      steps: [
        'In the left menu open **Organization**, then select **Public profile**. On a phone, open **More** and choose **Public profile**.',
        'Turn on **Show my organization page publicly** when you are ready for visitors to see the page.',
        'Check the **Page address**. Use lowercase letters, numbers and hyphens.',
        'Type a **Tagline** and a **Location**.',
        'Under **Organization picture** select **Upload**, choose your logo, adjust it if asked and confirm. Do the same for **Cover picture** with **Upload a picture**.',
        'Write your description in **About**.',
        'Select **Save** at the bottom of the form.',
      ],
      expected: 'A confirmation appears and the changes are kept. Opening the page again shows what you saved.',
      trouble: 'If a picture is refused it is usually larger than 5 MB or not a JPG, PNG or WEBP file. Make it smaller or save it in one of those formats. If **Save** does nothing, check that **Page address** is filled in.',
    }) +
    pair('org/profile', {}, {}, 'The Public profile page on a computer and on a phone.') +
    h3('Previewing your public page') +
    task({
      title: 'See your page as a visitor does',
      steps: ['Open **Organization → Public profile**.', 'Select **View page**.'],
      expected: 'Your public page opens in the same window, showing the tagline, location, pictures and About text, and the **Events** and programmes you have published.',
      trouble: 'If the page says it is not available, the **Show my organization page publicly** switch is off, or the AAICBI team has not yet switched on public pages.',
    }) +
    h3('Other things that affect how you appear') +
    bullets([
      '**Program skills** (Organization → Program skills): list the skills each course teaches, separated by commas, for example “SQL, Power BI, Excel”, then select **Save skills**. People who watch a video about a skill are shown matching programmes.',
      '**Events** (Organization → Events): see {{ev}}.',
      '**Certificates** (Teaching → Certificates): the certificate trainees receive carries your logo.',
    ]).replace('{{ev}}', 'Chapter 9') +
    tip('Review your page on your phone as well. Most visitors will see it there first.'));

  const ch5 = chapter('o5', 5, 'Managing Trainees',
    'What you can do with the trainees on your courses, and what needs a different role or the AAICBI team.',
    h3('Who counts as your trainee') +
    p('Your trainees are the people **enrolled in your courses**. You only ever see your own trainees, never another organisation’s. Seats in your plan limit how many can be active at once; the **Seat usage** bar on the Overview shows how many are used.') +
    h3('Where to find trainees') +
    table(['I want to…', 'Go to', 'You will see'], [
      ['See the newest enrolments and who has finished', '**Organization → Overview → Recent trainees**', 'Trainee, course, status (In progress, Completed) and enrolment date. Use the search box to find a name or course.'],
      ['See everyone in one course', '**Teaching → Courses →** your course **→ Enrolments**', 'The people enrolled in that course.'],
      ['See scores and progress of everyone in a course', '**Insight → Performance**, then choose a course', 'Each trainee’s performance in that course.'],
      ['See who needs help early', 'A course’s **Early warnings** page', 'Trainees who may be falling behind.'],
      ['Write to a trainee', '**Insight → Messages**', 'Your conversations with trainees.'],
    ]) +
    note('There is no separate “all trainees” list in the organisation menu. Trainees are reached through the Overview, your courses, Performance and Messages.') +
    h3('Enrolments and cohorts') +
    p('Trainees enrol in a course themselves (and pay if the course is paid), or are placed in a course by the arrangements your organisation has with AAICBI. Inside each course you can organise trainees into **cohorts** and review the enrolments list. Details of these course pages are in Chapter 6.') +
    h3('Account or enrolment problems') +
    bullets([
      'A trainee cannot find a course: check the course is **Published** (Courses list) and that they are enrolled.',
      'You have no seats left: the Overview shows “n of n seats used”. Contact AAICBI to change your plan.',
      'A trainee cannot sign in or has lost a password: the trainee uses **Forgot your password?** on their own sign-in page. You cannot reset a trainee’s password for them.',
      'A trainee’s profile contains something wrong: ask them to correct it, or use the reporting tools described in Chapter 8.',
    ]) +
    h3('What is not available to organisations') +
    p('Organisation accounts cannot create or delete trainee accounts, cannot see trainees of other organisations and cannot change a trainee’s email or password. Where an action needs the AAICBI team, the page says so or the control is not shown.'));
  return [ch4, ch5];
};

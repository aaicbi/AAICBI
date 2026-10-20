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
      ['See everyone in one course', '**Teaching → Courses →** your course **→ Enrollments**', 'Each person enrolled, with their status (for example **Active** or **Completed**), and **Revoke** and **Extend Access** controls.'],
      ['See scores and progress of everyone in a course', '**Insight → Performance**, then choose a course', 'Each trainee’s performance in that course.'],
      ['See who needs help early', 'A course’s **Early Warnings** page', 'Trainees who crossed an inactivity or failed-attempts threshold you set for the course.'],
      ['Write to a trainee', '**Insight → Messages**', 'Your conversations with trainees.'],
    ]) +
    note('There is no separate “all trainees” list in the organisation menu. Trainees are reached through the Overview, your courses, Performance and Messages.') +
    h3('Enrolling a trainee', 'o5-enrol') +
    task({
      title: 'Give a trainee access to a course',
      purpose: 'Add a trainee to a course yourself, including a paid course, for example after an offline payment or a support case.',
      before: 'The trainee already has an AAICBI trainee account and you know the email address they registered with.',
      steps: [
        'Open **Teaching → Courses** and select **Manage** on the course.',
        'In the list of links at the top right of the course page, select **Enrollments**.',
        'Type the trainee’s address into the box that shows **trainee@example.com**.',
        'Select **Grant Access**.',
      ],
      expected: 'The trainee appears in the list below with the status **Active**, and the course shows in their **My courses**.',
      trouble: 'A red message under the box tells you why (for example that no trainee account exists for that address — ask them to create one first). Trainees can also enrol themselves in a free course from the course page; **Copy Trainee Link** on the page copies the link to share.',
    }) +
    pair('org/course-enrollments', {}, {}, 'The Enrollments page of a course: grant access by email, copy the trainee link, and **Revoke** or **Extend Access** for each person.') +
    task({
      title: 'Extend or revoke a trainee’s access',
      steps: ['Open the course’s **Enrollments** page.', 'Find the trainee. To end their access select **Revoke**. To give more time select **Extend Access**, enter the number of days and a **reason** (it is kept in the audit trail), then confirm.'],
      expected: 'The status changes (**Expired / Revoked** after a revoke) and the change is recorded with your reason.',
    }) +
    h3('Cohorts') +
    p('A **cohort** (also called an intake) is an optional roster for reporting on one group of trainees separately. Every trainee can still use the course whether or not they are in a cohort. Open a course and choose **Cohorts / Intakes**, then **+ New Cohort**. Cohorts also appear as a filter on the **Performance** page.') +
    pair('org/course-cohorts', {}, {}, 'Cohorts / Intakes for a course. A new course has none until you create one.') +
    h3('Account or enrolment problems') +
    bullets([
      'A trainee cannot find a course: check the course is **Published** (Courses list) and that they are enrolled.',
      'You have no seats left: the Overview shows “n of n seats used”. Contact AAICBI to change your plan.',
      'A trainee cannot sign in or has lost a password: the trainee uses **Forgot your password?** on their own sign-in page. You cannot reset a trainee’s password for them.',
      'A trainee’s profile or messages contain something wrong: see Chapter 8 for moderation and reporting.',
    ]) +
    h3('What is not available to organisations') +
    p('Organisation accounts cannot see trainees of other organisations and cannot change a trainee’s email or password. Where an action needs the AAICBI team, the page says so or the control is not shown.'));

  const ch6 = chapter('o6', 6, 'Managing Courses and Training Activities',
    'Everything you need to create a course, publish it, follow it and issue certificates.',
    h3('The Courses list') +
    p('Open **Teaching → Courses**. Each course is a card with its title, the number of modules and a status: **Draft** (only your team sees it) or **Published** (trainees can find and join it). Select **Manage** to open a course, or **+ Create Course** to start a new one.') +
    pair('org/courses', {}, {}, 'The Courses list on a computer and on a phone.') +
    task({
      title: 'Create a course',
      purpose: 'Start a new programme that trainees can enrol in.',
      before: 'You are an Owner, Manager or Editor.',
      steps: [
        'Open **Teaching → Courses** and select **+ Create Course**.',
        'Type the **Course Title** (required) and a **Description**.',
        'Leave **This course is free (lifetime access, no payment)** ticked for a free course, or untick it if you will set a price later.',
        'Select **Create & Add Modules**.',
      ],
      expected: 'The new course opens as a **Draft**, ready for modules and lessons.',
      trouble: 'If nothing happens, check that the title is filled in.',
    }) +
    pair('org/course-new', {}, {}, 'Create Course. Only a title is required; everything else can be added afterwards.') +
    h3('Inside a course') +
    p('A course page gathers everything about one course. A row of links at the top right opens the related pages: **Copy Trainee Link**, **Certificates Issued**, **Q&A**, **Enrollments**, **Cohorts / Intakes**, **Early Warnings**, **Performance**, **Course Examination** and **Preview as Trainee**. The **Status** menu switches between Draft and Published. Below that the page has these sections:') +
    table(['Section', 'What you do there'], [
      ['**Work on this together**', 'Make an **invite link** so a colleague, instructor or another organisation can help build the course as an editor, or a **copy link** that gives another organisation their own independent copy. Editors change content; the owner keeps publishing, pricing, deleting and sharing.'],
      ['**Pricing & Access**', 'Free or paid access.'],
      ['**Certificate Template**', 'Choose which of your approved certificate templates this course uses.'],
      ['**Early-Warning Thresholds**', 'Set when a trainee counts as inactive or at risk of failing.'],
      ['**Q&A Scope**', 'Who can see and post in a lesson’s question thread: everyone, or only the trainee’s cohort.'],
      ['**WhatsApp Study Group**', 'Paste a group invitation link; enrolled trainees then see a **Join WhatsApp Group** button.'],
      ['**Schedule & Registration**', 'Start and end dates, registration deadline, capacity and location, for courses announced in advance.'],
      ['**Ayakbi Arena rules** and the moderation panels', 'Rules of play and tools for chat and games on this course (Chapter 7).'],
      ['**Course Information & Marketing Materials**', 'The details shown on the public course page: category, level, duration, instructors, prerequisites, what trainees will learn. Switches choose what is visible; you can upload a flyer and a curriculum.'],
      ['**Modules and lessons**', 'Each module has lessons and materials. Use **+ Add Lesson**, **+ Add Material** and **+ Add Module**, and the **Assessment**, **Edit** and **Delete** links. The arrows reorder items.'],
    ]) +
    pair('org/course-detail', { crop: 0.3 }, { crop: 0.16 }, 'The top of a course page (the real page is much longer and continues with the sections listed above). On a phone the same sections are stacked in the same order.') +
    note('Editors can build and edit but cannot publish, unpublish or delete a course, or change pricing or sharing. Those belong to Owners and Managers.') +
    h3('Examinations, assignments and certificates') +
    table(['Page', 'What it is for', 'How to start'], [
      ['**Teaching → Examinations**', 'Formal examinations with question banks and results.', '**+ Create Examination**; you can upload a Word document of questions.'],
      ['**Teaching → Assignments**', 'Written work set for trainees, with AI-assisted marking that you can review.', '**Upload Word Document** or **Create Manually**.'],
      ['**Teaching → Certificates**', 'Design the certificate trainees receive, with your own logo.', 'Enter a **Template name** and **Create template**, or **Choose a starting template**. Use the design tools (text, fields, logo, QR code, shapes) and **Upload template** to use your own background. Templates are sent for approval.'],
    ]) +
    pair('org/exams', {}, {}, 'Examinations. A new organisation has none until it creates one.') +
    pair('org/assignments', {}, {}, 'Assignments, with the two ways to create one.') +
    h3('Following a course') +
    bullets([
      '**Performance** for a course shows total trainees, average completion, average assessment score, at-risk trainees and certification rate, with a table per trainee (Chapter 10).',
      '**Early Warnings** lists trainees who crossed an inactivity or failed-attempts threshold.',
      '**Q&A** lists every question thread across the course, most recent first.',
      '**Certificates Issued** shows certificates; they are issued automatically when a trainee completes every module.',
      '**Preview as Trainee** shows the course exactly as a trainee sees it before you publish it.',
    ]) +
    tip('Open **Preview as Trainee** and check the course on your phone before you publish it. Then set the **Status** to **Published**.'));
  return [ch4, ch5, ch6];
};

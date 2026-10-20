// Trainee manual, chapters 5 to 8.
module.exports = (L) => {
  const { chapter, p, bullets, task, tip, warn, note, pair, table, h3 } = L;

  const ch5 = chapter('t5', 5, 'Finding Organisations, Courses, and Opportunities',
    'How to search, how to look at profiles, and how joining a course really works.',
    h3('Searching') +
    p('Use the search box at the top of public pages, or **Search pages** (**Ctrl + K**) inside your dashboard. Type a word and select **Search**. Use the buttons **All, People, Organizations, Employers, Investors, Startups, Jobs, Programs, Posts, Comments, Videos** and **Events** to narrow the results. Select a result to open its profile.') +
    pair('shared/search', {}, {}, 'Search results for “data”.') +
    h3('Finding training organisations, jobs and events') +
    bullets([
      '**Explore** (trainee menu) puts organisations, jobs and events in one place.',
      '**Organizations** (public pages) lists training organisations; open one to see its tagline, programmes and events, and to follow it.',
      '**Job board** lists open jobs from the platform’s employers, with apply buttons.',
      '**Events** lists events announced by organisations.',
    ]) +
    pair('trainee/explore', {}, {}, 'Explore: organisations, jobs and events in one place.') +
    h3('Finding courses') +
    p('Open **Courses** in your menu. It lists the courses available to you as cards. Each card shows a picture, **FREE** or **PAID**, the organisation that runs it and the number of modules. A course you are already in shows **Continue learning**; any other shows **View course**.') +
    pair('trainee/courses', {}, {}, 'Courses. Cards for courses you are in say **Continue learning**.') +
    h3('How joining a course works', 't5-join') +
    task({
      title: 'Join a course',
      purpose: 'Get access to the lessons, practice and assessments of a course.',
      steps: [
        'Open **Courses** and select **View course** on a course that interests you.',
        'Read the course page. If the page says “You’re not enrolled in this course yet”, look at the line beneath it.',
        'For a **free** course the page says it is free: select the enrol button to get started.',
        'For a **paid** course the page shows the price and says you will pay securely through Paystack. Some courses also offer a free preview of the first modules.',
        'If your training organisation has arranged access for you, ask them to **Grant Access** using the email address you registered with. The course then appears for you.',
      ],
      expected: 'The course page changes to show your lessons and a progress bar, and the course appears on your dashboard.',
      trouble: 'If you cannot pay or the button shows an error, read the red message under it. Do not pay twice; contact your organisation or support (see **Getting help**).',
    }) +
    note('Joining is not always automatic. Free courses can be joined by you; paid courses need payment; and some access is granted by your training organisation. The platform does not let you join an organisation just by clicking — its courses are how you take part.') +
    h3('Other opportunities') +
    bullets(['**Introductions**: employers who want to meet you send requests here; you can accept or decline.', '**My videos** and **Video requests**: organisations may ask to present your project in a video; you approve or decline.', '**My startups** and pitches: for founders and trainees with a startup idea.']));

  const ch6 = chapter('t6', 6, 'Participating in Training Activities',
    'Studying a course, practising, taking assessments and reading your results.',
    h3('Opening a course') +
    p('From **Courses** or from the course card on your dashboard, select **Continue learning**. The course page lists its **modules**. Each module has **lessons** (reading materials and videos), **practice** and an **assessment**. Complete the lessons to move on; some modules unlock one after another.') +
    pair('trainee/course-detail', {}, {}, 'A course page with its modules (shortened).') +
    h3('Lessons and resources') +
    p('Open a lesson to read or watch it. Videos play inside the page. Materials you can save for offline study appear under **My downloads**. On each lesson you can use **Q&A** to ask a question; your instructor and coursemates can reply.') +
    h3('Practice') +
    p('**Practice** lets you answer questions without any pass or fail. It plays in short rounds with encouraging messages, and shows the correct answer and an explanation after each question. Nothing in practice counts against you.') +
    pair('trainee/module-practice', {}, {}, 'Practice for a module.') +
    h3('Assessments and examinations') +
    task({
      title: 'Take a module assessment',
      before: 'You have finished the lessons of the module and the assessment is available.',
      steps: ['Open the course and the module, then select **Assessment**.', 'Read the instructions: the number of questions, time allowed, attempts and the **pass mark**.', 'Select **Start** and answer each question.', 'Submit when you finish.'],
      expected: 'You see a result page with your score and whether you passed.',
      trouble: 'If the timer ends the attempt is submitted automatically. If you lose your connection, reconnect and reopen the assessment from **Examinations**.',
    }) +
    p('**Examinations** in the menu lists every module assessment and course examination you have access to, with the number of questions, duration, attempts, pass mark and your status (for example **Available** or **Passed**). Select **Start** to begin or **View result** to see a past result.') +
    pair('trainee/examinations', {}, {}, 'Examinations: your assessments and results in one table.') +
    h3('Assignments and certificates') +
    bullets(['**Assignments** shows written work set by your instructors. Submit your answer and read the feedback afterwards. Pasting text into answers is blocked, so write your own words.', '**Certificates** lists certificates you earn when you complete a course. Each has a link anyone can use to verify it.']) +
    pair('trainee/assignments', {}, {}, 'Assignments.') +
    h3('Progress, announcements and messages') +
    p('Your progress bar on each course shows modules completed. Course news arrives as notifications and in **Messages**. See Chapter 9 to understand your results.'));

  const ch7 = chapter('t7', 7, 'Using Group Chats and Community Features',
    'Talking with coursemates, asking questions and keeping chat friendly.',
    h3('The course group chat') +
    p('Each course can have a group chat for the people enrolled in it. It appears only when the AAICBI team has switched it on for your course. You can reach it from **Ayakbi Arena**, from the **Chat is live** card on your dashboard, or from the course page.') +
    pair('trainee/arena-chat', {}, {}, 'The course chat: messages from coursemates, challenge cards and reactions.') +
    task({
      title: 'Send a message in the course chat',
      steps: ['Open **Ayakbi Arena** and choose your course, then open the chat. (Or select **Open chat** on a **Chat is live** card.)', 'Type your message in the box at the bottom. Messages can be up to 500 characters.', 'Select the send button.', 'To react without typing, use the reaction row (one tap posts a large emoji).'],
      expected: 'Your message appears in the chat for everyone enrolled in the course.',
      trouble: 'If you cannot post, you may be paused by a moderator (the page shows why and until when), or the chat may be switched off for your course.',
    }) +
    h3('Asking good questions') +
    bullets(['Say what you tried and where you got stuck.', 'Use the lesson **Q&A** for questions about one lesson, so everyone can find the answer later.', 'Use **Messages** for private questions to your instructor.']) +
    h3('Respectful conduct') +
    bullets(['Be kind. No insults, threats or bullying.', 'Do not share answers to assessments.', 'Do not share other people’s private information.', 'Moderators can remove messages, pause your participation or end a game. Every decision is recorded with a reason.']) +
    h3('Who is online') +
    p('The arena shows who is online in your course and lets you challenge them. Anyone signed in with the app open counts as online.') +
    h3('Notifications and messages') +
    p('The bell shows alerts; the round **Messages** button (bottom right) opens one inbox with your course group chats, cohort chats and direct messages. You can start a new direct message with the plus button. A number on the button or on the app icon shows unread messages.') +
    pair('trainee/messages', {}, {}, 'Messages.') +
    h3('Reporting inappropriate behaviour') +
    bullets(['During a game, use the report option in the match.', 'For a person or profile, open **Report a concern** and describe what is wrong.', 'For anything urgent, message your instructor or organisation.']) +
    h3('Chat rules and moderation') +
    p('Your training organisation’s moderators and AAICBI can remove messages, pause your participation for a time, end a game or warn you. If you are paused, the lobby tells you why and until when. You can still read your lessons and take assessments.'));

  const ch8 = chapter('t8', 8, 'Playing Educational Games',
    'Games make practice fun. They are optional, free of pass or fail, and only appear where your course has them switched on.',
    h3('Where games appear') +
    bullets([
      '**Practice and course games** in a module: quizzes, matching and ordering questions and scenarios.',
      '**Ayakbi Arena**: a two-player question game with a course chat.',
      '**Games on the feed**: a taste of a course that you can try without an account.',
    ]) +
    pair('trainee/arena', {}, {}, 'Ayakbi Arena lists the courses where it is open.') +
    h3('Practice games') +
    p('In a module open **Practice**. Questions come in rounds of ten. After each answer you see whether it was right, the correct answer and why. At the end a summary shows your score and the answers to review. A streak and small celebrations are only for fun. Sound is off until you switch it on in the game.') +
    h3('Ayakbi Arena: playing with another trainee') +
    task({
      title: 'Challenge a coursemate',
      before: 'The Arena is switched on for your course.',
      steps: ['Open **Ayakbi Arena** and choose the course.', 'In the lobby find a coursemate (the list shows who is online and who is not) and select to challenge them. You can also use the ⚔️ button in the course chat.', 'Wait for them to accept. They are notified in their bell and on their phone if alerts are on.', 'When the game starts, answer the question before the timer runs out. If one player misses, the other gets a short chance to answer for extra points.'],
      expected: 'The game plays one question at a time with a scoreboard, then a result screen with your score and ladder points.',
      trouble: 'If nobody answers your challenge it expires, you are told, and you can challenge again or message them in the chat.',
    }) +
    pair('trainee/arena-course', {}, {}, 'A course’s arena: who is online, challenges and recent matches.') +
    h3('Group chat games: Fastest Fingers') +
    p('Your instructor may post a quick question in the course chat as a card. Answer it first and correctly to earn credits; everyone sees who won. Your credit total for the course is shown in the chat.') +
    h3('Scores, results and leaderboards') +
    p('After each game you see your score. The **ladder** of each course ranks players by rating and tier (Bronze, Silver, Gold, Platinum, Champion). You appear after five counted games. A weekly champion is announced in the chat.') +
    pair('trainee/arena-ladder', {}, {}, 'A course ladder.') +
    h3('Game rules and moderation') +
    bullets(['Play fairly: no cheating and no abuse in match chat.', 'You can leave a game with **Quit**; the other player wins. You can also pause (a limited number of times).', 'If you are reported, a moderator may warn you, pause your participation or end the game, and records a reason.']) +
    h3('If something goes wrong') +
    table(['Problem', 'What to do'], [
      ['A game will not load', 'Check your connection, refresh the page and open the Arena again. If you left a game, a gold bar at the top lets you return.'],
      ['A session ended unexpectedly', 'A moderator may have ended it, or a player quit or lost connection. Check your notifications for a message.'],
      ['A result looks wrong', 'Message your instructor with the time and the other player’s name. Moderators can review a match.'],
      ['I cannot start games', 'You may be paused in that course (the lobby says so), or the Arena may be off for the course.'],
    ]));

  return [ch5, ch6, ch7, ch8];
};

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
  return [ch1, ch2];
};

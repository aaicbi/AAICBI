# Testing on real devices

Emulation (see `scripts/device-checks/`) covers layout, navigation, permissions and workflows at phone and tablet sizes. These checks need a real device, because they depend on the device's own browser, keyboard, operating system or network. Allow about 30 minutes per device. Note the device, operating system and browser version with anything you report.

Devices: an Android phone (Chrome), an Android tablet (Chrome), an iPhone (Safari), an iPad (Safari). Use one trainee account, one employer account and one organization account.

## 1. Install (each device)
- [ ] Android Chrome: after a second visit the "Install the app" card appears; **Install** adds the icon. Opening it shows the AAICBI splash and no browser bar.
- [ ] iPhone/iPad Safari: the card shows the Share, Add to Home Screen steps; following them adds the icon (not blurry, not cropped, teal background). Opening it has no Safari bar and the status bar looks right.
- [ ] After installing, the card never appears again; **Not now** hides it for a month.
- [ ] Press and hold the icon (Android): the Messages, Events and Alerts shortcuts work.
- [ ] Open the installed app signed in as each role: it lands on that role's home. Signed out it lands on the landing page.

## 2. Layout and navigation
- [ ] The bottom bar sits above the browser/gesture bar and is not covered by the iPhone home indicator. Nothing important is hidden behind it at the bottom of any page.
- [ ] Rotate the phone and tablet: layout adjusts, nothing is cut off, a typed message is not lost. iPad landscape shows the sidebar, portrait shows the bottom bar.
- [ ] Tabs for each role: trainee (Home, Messages, Events, Alerts, More), employer (Home, Messages, Talent, Alerts, More), organization (Overview, Messages, Events, Alerts, More). **More** lists the full menu; Escape/close and tapping outside close it.
- [ ] The Loop button and the messages button on the right do not cover the bottom bar or the main buttons; the Loop chat opens above the bar and its keyboard does not hide the message box.
- [ ] Phone home screens: trainee, employer, organization show the short home in the intended order; **Show full dashboard** and **Back to simple view** work.
- [ ] Tables (for example Analytics, Examinations) appear as cards on a phone with every value labelled, and as tables on a tablet.
- [ ] Complex pages (course builder, exam tools, certificate studio, analytics) show the larger-screen note on a phone; **Copy link** copies or opens the share sheet; **Continue here** hides the note.

## 3. Forms and keyboards
- [ ] Registration pages (organization, employer) are stepped on a phone; Next refuses an empty required field; Enter moves forward, not submit; Register appears on the last step.
- [ ] Email field shows the email keyboard (@ visible), phone field the dial pad, link fields the URL keyboard; no auto-capitalised email addresses.
- [ ] Tapping a field does **not** zoom the page (iPhone); fields are easy to hit.
- [ ] Autofill/password manager fills login and registration correctly.
- [ ] Employer job posting, trainee pitch (new and edit), organization event, trainee video: stepped on a phone; the submit button stays visible above the bottom bar.
- [ ] Assignment answer box: paste is blocked with a message (long-press, Paste, and drag text in).

## 4. Messaging and notifications
- [ ] Trainee, employer, organization: send and receive messages; unread count and ordering look right; search works; the Alerts badge updates.
- [ ] An employer cannot start a chat with a trainee who has not accepted an introduction or applied; the trainee can message that employer back once they have.
- [ ] Turn on Alerts (Notifications page; on iPhone/iPad only from the installed app). Send a message from another account: the push arrives with the sender's name and **not** the message text; tapping it opens the conversation.
- [ ] Turn alerts off: nothing more arrives.

## 5. Network
- [ ] Airplane mode in the installed app: the offline page appears on navigation with a working **Try again**; the "You're offline" notice appears on a page you are already on.
- [ ] Type a message, go offline, press Send: the text is kept and a clear message appears; reconnect and send it.
- [ ] Turn the connection to slow (Android: Developer options or a throttled network): pages show loading states, never a blank screen; the bottom bar and menus stay usable.
- [ ] Sign out: nothing from the account is visible afterwards, including when offline.

## 6. Accessibility
- [ ] Zoom text to 200% (system font size): no overlap on the bottom bar, forms or cards.
- [ ] Screen reader (TalkBack/VoiceOver): the bottom bar reads "Main" navigation with the current page; More opens as a dialog; step headers read "Step 2 of 3".

## 7. Performance
- [ ] On a mid-range or older phone, the home screen is usable within a few seconds on a normal mobile connection; scrolling is smooth; no long freezes when opening More or the Loop chat.

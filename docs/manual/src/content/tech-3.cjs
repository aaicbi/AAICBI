// Technology guide, chapters 6 and 7: the Ayakbi Arena and growth games, the Certificate Studio and document engines.
module.exports = (L) => {
  const { chapter, p, bullets, table, tip, warn, note, h3, h4, why, pair, shot, svgFigure } = L;

  const ch6 = chapter('x6', 6, 'The Ayakbi Arena, real time and the growth games',
    'Two learners play each other live on their phones. This chapter explains how that stays fair, fast and cheap.',
    h3('What the Arena is') +
    p('The Ayakbi Arena lets two trainees on a course challenge each other to a live question game, chat in a course group chat, answer quick “Fastest Fingers” questions from an instructor, climb a ladder, watch live matches and join knockout events. It is **off everywhere until a Super Admin switches it on**, per platform, organisation or course, and the narrowest setting wins. Instructors can change the rules of play on their course but never the switches.') +
    pair('tech/arena-settings', {}, {}, 'The Super Admin’s Arena settings: switches and rules, for the whole platform, an organisation or one course.') +
    h3('The architecture: the database decides, real time only nudges') +
    svgFigure(`<svg viewBox="0 0 900 250" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica,Arial,sans-serif" role="img" aria-label="A player action goes to the server, which settles deadlines, checks the rules, saves with a version check, then pokes the real time service; browsers fetch their own view">
<defs><marker id="b" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#005650"/></marker></defs>
<rect x="10" y="20" width="150" height="70" rx="10" fill="#EAF0EB" stroke="#005650"/><text x="85" y="50" text-anchor="middle" font-size="13" font-weight="700">Player A phone</text><text x="85" y="70" text-anchor="middle" font-size="11">taps an answer</text>
<rect x="260" y="10" width="380" height="120" rx="10" fill="#fff" stroke="#005650" stroke-width="2"/><text x="450" y="32" text-anchor="middle" font-size="13" font-weight="700" fill="#014A43">Server action on the match</text>
<text x="450" y="54" text-anchor="middle" font-size="11.5">1 load match  2 settle every deadline already passed</text><text x="450" y="74" text-anchor="middle" font-size="11.5">3 apply the action if the rules allow it</text><text x="450" y="94" text-anchor="middle" font-size="11.5">4 save only if the version number is unchanged</text><text x="450" y="114" text-anchor="middle" font-size="11.5">5 send a “something changed” signal</text>
<rect x="740" y="20" width="150" height="70" rx="10" fill="#EAF0EB" stroke="#005650"/><text x="815" y="50" text-anchor="middle" font-size="13" font-weight="700">Player B phone</text><text x="815" y="70" text-anchor="middle" font-size="11">fetches its own view</text>
<path d="M160 55 L258 55" stroke="#005650" stroke-width="2" marker-end="url(#b)"/>
<path d="M640 55 L738 55" stroke="#005650" stroke-width="2" marker-end="url(#b)" stroke-dasharray="5 4"/>
<rect x="260" y="160" width="380" height="70" rx="10" fill="#F6E8CC" stroke="#D99A34"/><text x="450" y="188" text-anchor="middle" font-size="13" font-weight="700" fill="#6E480E">Ably (or polling every 1.5 s if there is no key)</text><text x="450" y="208" text-anchor="middle" font-size="11" fill="#3a2a08">carries no answers and no scores: only “fetch the latest”</text>
<path d="M450 130 L450 158" stroke="#D99A34" stroke-width="2" marker-end="url(#b)"/>
</svg>`, 'One move in a match. The state of the game is always in the database; real time only tells the other phone to look again.') +
    bullets([
      '**Deadlines are the server’s.** Every request first moves the match forward past any deadline that has already passed, so a match never depends on a browser staying open. A match can progress, time out or forfeit (three missed turns in a row) with nobody watching.',
      '**Versioned saves.** A save succeeds only if the match’s version number is unchanged; otherwise it retries up to four times and then answers “the match changed while you were acting”. Two players tapping at the same moment cannot corrupt the score.',
      '**Each player gets a private view.** The page is rebuilt for each player and never contains the answer key, the other player’s wrong answer, or the question while the game is paused.',
      '**The server picks the question** behind a chosen number on the board, “so nobody can peek”.',
    ]) +
    why('written', '`arenaCore.ts` and `arenaView.ts`: “any request moves a match forward past deadlines that have already passed, so the game never depends on a browser staying open”; “The browser never receives the answer key, the other player’s wrong answer, or the question while the game is paused.”') +
    h3('Ably, the Server-Sent Events stream and the polling fallback') +
    p('Ably is used only on the server (`Ably.Rest`), and only to publish a tiny message with a version number. Browsers receive a short-lived, **subscribe-only** token (one hour) scoped to their own channels, and listen over a plain event stream — the Ably JavaScript library is not shipped to phones. If there is no Ably key, or the stream drops, the page polls every 1.5 seconds, pauses while the tab is hidden, backs off to every 8 seconds as a safety net when live, and renews its token at 50 minutes. A page also notices when the server is a newer release than its own and reloads once.') +
    why('written', '`realtimeCore.ts`: browsers can only subscribe; “Every message is sent by our server after it has checked the rules, so nobody can forge a score … Messages carry no answers and no private details”. `realtime.ts`: it is “the only file that knows about Ably” and “with no ABLY_API_KEY the arena still works: pages simply check for changes every second or two”.') +
    why('inferred', 'Using the plain event stream instead of the vendor’s browser library keeps the phone download small and avoids bundling a library for older phones; a managed real-time service avoids running and scaling a WebSocket server of our own.') +
    h3('The rules of the match (values from the code)') +
    table(['Rule', 'Value'], [
      ['Question formats', 'All four: quiz, matching, ordering, scenario, graded by the same functions as the Studio. Only approved practice questions and approved items are used — never the assessment pool.'],
      ['Base points', 'Quiz 80, matching 100, ordering 120, scenario 100; a speed bonus up to 20% of base on a first correct answer.'],
      ['Steal window', '20 seconds for the other player to answer a missed question for base points plus the bonus (default +50%: 80 becomes 120).'],
      ['Question timer', 'Default 60 seconds (instructor range 10 to 180); 20 questions per match by default (4 to 30).'],
      ['Pauses', '2 per player of up to 60 seconds, then the game resumes by itself.'],
      ['Invitations', 'Wait 10 minutes if the opponent is online, 60 if away; a lobby lapses after 15 minutes; a match is abandoned after 30 minutes without activity.'],
      ['Chat', 'Match chat up to 140 characters; course chat up to 500 characters, last 60 messages from the last 7 days; repeat text within 10 seconds is ignored.'],
    ]) +
    why('written', 'The code is authoritative: `STEAL_SECONDS = 20`. The older Release 2 text in `docs/gaming-arena.md` says 5 seconds; Release 3 and the code say 20. Phones play upright because, in the document’s words, “Kahoot, Trivia Crack, QuizUp and Duolingo all do: one hand, thumb reach, text-heavy questions read naturally, and nobody has to turn the phone”.') +
    h3('The ladder, Fastest Fingers and the credit wallet') +
    table(['Feature', 'How it works', 'Safeguard'], [
      ['Elo ladder', 'Everyone starts at 1000; K = 32; expected score is 1 / (1 + 10^((theirs − mine) / 400)); the change is round(K × (result − expected)). Tiers: Bronze under 1000, Silver 1000, Gold 1200, Platinum 1400, Champion 1600. A player appears after 5 counted matches.', 'The same two players count at most 3 matches a day; a result settles once (a unique record absorbs a repeat); a moderator can void a match and ratings are restored; the weekly champion is found the first time anyone looks after the week turns, with no scheduled job.'],
      ['Fastest Fingers', 'An instructor posts an approved or custom question with 1 to 100 credits; each trainee gets one try.', 'The winner is decided by a single atomic update (“only if still open and no winner”), so two simultaneous correct answers cannot both win; the key stays hidden until it closes.'],
      ['Credit wallet', 'Credits from Fastest Fingers can be sent to a coursemate (1 to 100 at a time, up to 300 a day, never more than the balance). It has its own Super Admin switch, off by default.', 'A database advisory lock inside a transaction stops two simultaneous sends double-spending; every award has a unique reason and reference so repeats are ignored.'],
      ['Spectators and live events', 'Enrolled learners can watch a live match and send emoji cheers; instructors can run a single-knockout event seeded by ladder rating, with a big-screen view.', 'Watchers cannot be players or suspended; viewing changes nothing in the match.'],
      ['Moderation', 'Reports (cheating, abuse, other), ending a live match, voiding a result, removing a message, suspending a player from one hour to 90 days.', 'Every decision stores who did it; organisations moderate only their own courses, with a required reason.'],
    ]) +
    pair('tech/arena-chat', {}, {}, 'The course chat on a phone, with challenge cards and reactions.') +
    pair('tech/arena-ladder', {}, {}, 'A course ladder on a phone: podium, tiers and the player’s own place.') +
    h3('Notifications for games') +
    p('A challenge creates a bell entry and a web push that stays on screen until tapped and vibrates the phone (`requireInteraction`, `vibrate` in the service worker). The app icon shows one combined attention number: unread group chats, direct and cohort messages and a waiting challenge. If no one answers, the challenger is told, and a daily job plus a lazy sweep (at most once every 30 seconds per server) settles lapsed invitations.') +
    h3('Growth games: the public taster, duels, squads and result cards') +
    p('A public link lets anyone with a phone try a five-question taster of a course with no account, then offers Module 1 free and payment after that. It draws only from the course’s approved practice questions, gives 18 seconds per question, and returns the answer key only after each answer. The funnel is off by default behind four switch layers and a readiness check, and every change is audited.') +
    bullets([
      '**Duels and squads.** A player can challenge a friend to the same five questions; the higher score wins and a clearly faster run (at least one second) breaks a tie. Squads of up to 50 play the captain’s questions and add their scores. Names are free text from anonymous people, so administrators can rename or remove them.',
      '**Result cards.** The share image is drawn with `next/og` (JSX to PNG) at 1200×630 (link preview) or 1080×1920 (WhatsApp Status), cached at the edge for a day, and shows only what the player chose to share. A percentile appears only after 30 finishers, “so a small crowd never produces a made-up claim”.',
      '**Leads and consent.** A saved score stores the phone number in +234 form, the exact consent wording and time, and a private opt-out link. Follow-up messages obey quiet hours (21:00–07:00 Nigerian time), a daily cap and stop at opt-out or payment.',
      '**Feed games.** A live game can be shown on the feed; any signed-in person can try a round, each graded answer is recorded, and the page says so. Answers earn no XP.',
    ]) +
    why('written', '`growth/*` and `docs/growth-funnel.md`: the assessment pool is never served; every switch is off until a Super Admin turns it on; the follow-up WhatsApp path was tested only against a stand-in for Meta’s service.') +
    h3('Why the Arena design suits AAICBI') +
    bullets([
      '**Fair and tamper-proof** because the server owns the clock, the questions, the scores and the order of moves.',
      '**Cheap to run** because there is no custom socket server; a one-line signal service plus the database does the job, and polling means it still works if the signal service is off.',
      '**Light on phones**: portrait layout, a plain event stream, CSS animation and synthesised sound.',
      '**Safe by default**: everything is off until switched on; moderation requires reasons and is audited.',
    ]));

  const ch7 = chapter('x7', 7, 'The Certificate Studio and document engines',
    'How an organisation designs a certificate, how it is issued and proved genuine, and how every other PDF and image is made.',
    h3('What the Certificate Studio is') +
    p('Each training organisation can design the certificate its trainees receive. The Studio is a drag-and-drop canvas where the organisation places text, dynamic fields, its logo, a QR code, shapes and icons on a page, or uploads its own background image. A new design starts from one of four presets (AAICBI Classic, Modern Minimal, Gold Elegant, Bold & Teal) or from blank. Organisations design on a larger screen; the Studio shows an “optimised for a larger screen” note on phones.') +
    pair('tech/certificate-studio', {}, {}, 'The Certificate Studio: create a template, choose a starting design, place elements on the canvas, upload a background.') +
    h3('The editor: Fabric.js in the browser') +
    p('The editor uses **Fabric.js 7**, a mature canvas library with a built-in model for selecting, dragging, resizing and rotating objects. Fabric has no official React bindings, so the editor drives it directly while a plain list of elements in React state stays the single source of truth that is saved.') +
    table(['Editor feature', 'How it works'], [
      ['Elements', 'Text (literal or a field), image (organisation logo or QR code), shape (rectangle or line) and icon (one of 18 built-in icons, or one from a Super Admin-managed uploaded pool). Up to 200 elements per design.'],
      ['Dynamic fields', 'Trainee name, verb, credential title, date issued, certificate code, organisation name, signatory name and signatory title.'],
      ['Page sizes', 'A4 landscape (1169×827), A4 portrait (827×1169), Letter landscape (1100×850), Letter portrait (850×1100). The design scale is about 100 units per inch and is scaled to fit when shown.'],
      ['Undo and redo', 'A stack of up to 50 full snapshots, with keyboard shortcuts; each undo reloads the objects rather than patching, because an undo can jump across an add or a delete.'],
      ['Snapping and guides', 'Within 6 units, an object snaps to other objects’ edges and centres and the page centre, with dashed guide lines. Fabric has no built-in version of this, so it is computed by hand.'],
      ['Multi-select and duplicate', 'Shift-click or box-select moves a group; right-click duplicates.'],
      ['Autosave', 'Saves automatically with a guard that compares against the last saved design.'],
      ['Background upload', 'JPG, PNG or WEBP up to 10 MB, only from the platform’s own file storage; the page resizes to the picture’s shape and, if the page is empty, five fields are laid out ready to drag.'],
    ]) +
    why('written', '`CertificateCanvasEditor.tsx`: “Imperative, not declarative (Fabric has no official React bindings the way Konva’s react-konva does)”; the React element list, “never Fabric’s own internal object graph”, is the single source of truth. Comments record real fixes: Fabric v6+ origins pinned to top-left because a 968-unit rectangle at x 16 once rendered at x −468; the canvas is scaled with a CSS transform rather than Fabric’s own sizing because of a horizontal-offset quirk.') +
    why('none', 'No document explains why Fabric.js was chosen over other canvas libraries.') +
    why('inferred', 'Fabric already provides the drag, resize, rotate and multi-select behaviour that would take months to build, and the saved design is plain data, so the library could be replaced later.') +
    warn('Accessibility limit stated by the team: the Fabric canvas “has not been checked for keyboard operation. Assume a person who cannot use a mouse cannot design a certificate there” (`docs/accessibility-testing.md`). The editor also has no contrast checker.') +
    h3('How a design is stored: bounded data, never markup') +
    p('A design is saved as JSON validated by a zod schema: every value is a bounded number, a short string or one of a fixed set of choices (font size 6 to 200, colours as `#RRGGBB`, positions within limits, at most 200 elements). There is no HTML anywhere in the design, so there is nothing to clean: the schema is the safety boundary. The renderer builds style objects, never strings of HTML.') +
    why('written', '`certificateLayout.ts`: “there is no markup anywhere in this shape, so unlike the HTML-import approach this replaces, there is nothing to sanitize: CertificateLayoutSchema’s own Zod validation IS the safety boundary.” The layout is “canvas-library-agnostic”.') +
    h3('Why a certificate never changes after it is issued: the design snapshot') +
    p('When a certificate is issued, the template’s design (layout, logo address, signatory and organisation name) is copied onto the certificate itself as a versioned snapshot. Re-assigning a course to another template, editing templates or removing a logo from the picture bank can never alter a certificate already handed out. “No template” is also a real recorded state: it means “issued with AAICBI’s own default design”. Logos used by approved templates cannot be deleted for the same reason.') +
    why('written', '`certificateDesignSnapshot.ts`: certificates used to be drawn live from whatever template the course pointed at, “so re-assigning a course to another template … silently re-designed every certificate already handed out. Snapshotting the design onto the Certificate row makes an issued certificate immutable the same way its code already is.”') +
    h3('Approval: the organisation signs off its own certificate') +
    table(['Step', 'What happens'], [
      ['1. Create and edit', 'The organisation (or a Super Admin) creates a template and designs it. A review code `CERTTPL-XXXX-XXXX` is generated immediately.'],
      ['2. Send for review', 'The organisation’s contact receives an email with a link to a public, no-login preview showing a sample certificate (“Jane Doe”, “Sample Course”).'],
      ['3. Approve', 'The contact approves with one click. The approval is a conditional update (“only if not yet approved”), so a double click or a replayed link cannot approve twice. The approve link is rate limited to 20 an hour per address.'],
      ['4. Locked', 'An approved template can no longer be edited, deleted or have its logo changed. Only approved templates can be assigned to a course.'],
    ]) +
    why('written', 'Approved templates are locked for “the same immutability the certificate code itself already has once issued”.') +
    why('inferred', 'A token link lets a signatory who has no platform account sign off the design, and organisations approve their own branding before it is used.') +
    h3('Issuance, the code and public verification') +
    bullets([
      '**When:** automatically, the moment a trainee passes the course examination (earlier versions issued at 100% module completion; older certificates were revoked by a one-off script rather than quietly kept, because two definitions of “AAICBI certified this person” would be worse).',
      '**Race-safe:** creation is “insert and ignore a duplicate”; an old row from the previous rule is upgraded in place with a conditional update. Issuance never throws, so a certificate problem can never affect exam submission.',
      '**Code:** `AAICBI-XXXX-XXXX` — eight random characters from an alphabet of 31 that leaves out look-alikes (no 0/O, 1/I/L), so people can copy it by eye.',
      '**Verification page** `/certificate/<code>` needs no sign-in, is limited to 60 lookups an hour per address, shows only the name, course, dates and code (never email or account details) and has three states: not found, revoked, valid. A QR code on the certificate points to it.',
      '**QR:** made on the server with the `qrcode` library as a PNG, offline and with no outside service, so there is nothing to configure or rate limit.',
      '**Revocation:** instructors or admins who own the course can revoke or restore; the public page reads the state live, so a revocation takes effect at once.',
      '**Printing:** “download” is the browser’s Print / Save as PDF on the same page, described in the code as “a deliberate scope decision, not an oversight”.',
    ]) +
    why('written', 'Schema comments: authenticity is a database lookup, not a cryptographic signature, because key management, a verification algorithm and key rotation would be “real added complexity”, and “a corrected database is more honest than an immutable one for a training certificate”, so revocation can work. The code alphabet avoids “characters people reliably mis-transcribe”. QR as a PNG avoids needing `dangerouslySetInnerHTML` in the render path.') +
    h3('The “Powered by AAICBI” mark') +
    p('The renderer draws “POWERED BY AAICBI.ORG” at the foot of the page itself, after the design elements, so nothing in a saved design can remove it. Removing it is a separate monthly Paystack subscription per organisation, or a Super Admin waiver. The state is read live, not frozen, because it is billing state. The default AAICBI design always carries it.') +
    why('written', '“There’s nothing in layoutJson an org could strip via the editor or a raw API call to remove it.” The watermark subscription is mirrored from platform-fee billing “rather than generalized … so a change to platform-fee billing can never silently also change watermark-removal billing’s behavior”.') +
    h3('Why certificates are drawn as HTML and not as server PDFs') +
    p('Certificates are shown on the public page as scaled HTML and CSS: the design is rendered in a fixed design-size box which is scaled to the screen by a resize observer. Fonts are ordinary CSS font names (for example Georgia or Helvetica), so they depend on the viewer’s system fonts. The team calls the absence of a server PDF pipeline for certificates a deliberate scope decision.') +
    why('none', 'The reason for choosing browser printing over a server-made certificate PDF is not written down beyond “deliberate scope decision”.') +
    why('inferred', 'It avoids shipping and licensing fonts for every organisation’s design and keeps one rendering path for the page, the preview and the print. The trade-off is that exact typography can vary by device.') +
    h3('Standalone exam certificates') +
    p('Standalone exams use a separate `ExamCertificate` record with the same code generator and the wording “has successfully passed”. They were kept apart from course certificates because forcing them together “would mean making Certificate.courseId nullable and bending its heavily race-condition-audited issuance logic”.') +
    h3('Every other document engine') +
    p('The platform makes nine other kinds of document or image, each with the simplest tool that fits.') +
    table(['Output', 'Tool', 'Notes'], [
      ['Curriculum outline PDF', '@react-pdf/renderer', 'Made on demand from the current course; public for visible courses.'],
      ['Assignment submission PDF', '@react-pdf/renderer', 'Emailed to the instructor when AI marking is off; not stored.'],
      ['Performance export', '@react-pdf/renderer', 'Course KPIs and a trainee table.'],
      ['Instructor agreement', '@react-pdf/renderer', 'Letter text plus a signature image embedded as text so it cannot go missing on the host.'],
      ['Trainee learning report', '@react-pdf/renderer', 'A trainee’s own activity report.'],
      ['Admin analytics report', '@react-pdf/renderer', 'Downloadable and sent weekly; stat grids and tables, no chart library.'],
      ['Growth share PDF', '@react-pdf/renderer', 'One page; the whole card is a link to the course funnel.'],
      ['Word to PDF', 'mammoth, node-html-parser, @react-pdf/renderer', 'Word is turned into HTML, parsed into a small set of document nodes (headings, paragraphs, lists, images, tables), then drawn; cached by file version.'],
      ['Result card images', 'next/og', '1200×630 and 1080×1920 PNG; edge cached.'],
      ['Animated promo card', 'Playwright and ffmpeg (an offline script)', 'MP4/GIF/PNG/WebP files built before release, not at run time.'],
      ['Picture shrinking', 'sharp', 'Turns stored pictures into WebP (quality 80) at 480, 1280 or 1600 px; replaced only if at least 15% smaller; the old file is deleted only if nothing still uses it.'],
    ]) +
    why('written', '`curriculumPdf.tsx`: react-pdf “was chosen specifically because it’s pure JS/Node (no headless-browser binary like puppeteer+@sparticuz/chromium would need), well within a standard Vercel serverless function’s size/time budget, and the standard tool for exactly this ‘structured document from data’ case.” PDFs are made on demand so there is “no cache-invalidation problem”. For Word to PDF: “No new heavy dependency, no headless-browser binary, no third-party API.”') +
    why('written', '`next.config.js` records a real production bug: PDF font files were missing from the Vercel bundle (“Cannot find module … Helvetica.cjs”), fine locally and broken on the host, fixed once for all PDFs with a file-tracing include.') +
    h3('Reading documents in') +
    table(['Kind', 'Tool', 'Rules'], [
      ['Word (.docx)', 'mammoth', 'Raw text, then plain pattern splitting into questions, then AI structuring; uncertain items are flagged for a person.'],
      ['Word (.doc)', 'word-extractor', 'Older format needs its own reader.'],
      ['PDF', 'unpdf', 'Text PDFs only; scanned PDFs are refused with a clear message.'],
      ['PowerPoint and Excel', 'jszip', 'Opened as zip files; slide and note text and sheet text are read from the XML.'],
      ['Detection', 'file bytes (magic numbers)', 'The type comes from the bytes, “not its name, which can lie”; text is capped at 60,000 characters.'],
    ]) +
    why('written', '`docxParser.ts`: the splitter is “deliberately dumb and regex-based … anything genuinely ambiguous is exactly what the AI structuring step and the human review screen are for”.') +
    h3('Why the Certificate Studio design suits AAICBI') +
    bullets([
      '**Branded and trusted.** Organisations design their own certificates, approve them themselves, and every certificate can be checked by anyone with a code or a QR.',
      '**Immutable once issued.** Snapshots, locked templates and unique codes mean a certificate means the same thing tomorrow as today.',
      '**Safe by construction.** Bounded data, no markup, an allow-list for backgrounds, rate limits on public pages and an unremovable footer.',
      '**No heavy infrastructure.** No headless browser, no external QR or PDF service, no font licensing.',
    ]) +
    note('Gaps recorded by the research: there are no automated tests for certificate issuance, the watermark logic, the editor, the renderer or the PDF output, and a few comments are stale (for example one says the old default card “was removed”, but it is still the fallback for templates with no layout).'));

  return [ch6, ch7];
};

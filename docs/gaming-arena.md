# Ayakbi Arena

Two trainees challenge each other on a course, live. This page describes what is built; the full plan is in the product brief.

## Release 1: switches, rules and the real-time connection

### Switches (Super Admin, `/admin/arena`)
Everything is **off** until a Super Admin switches it on. Settings are kept per scope: the whole platform, one organization, or one course. The narrowest scope that sets a value wins; a value left blank follows the wider scope.

| Switch | What it does |
|---|---|
| Ayakbi Arena | Master switch. Nothing works while it is off. |
| Two-player Interview game | Challenges, lobby, match, results, rematch. Needs the master switch. |
| Course chat | Built in a later release (the switch is shown but disabled). |
| Champion ladder | Built in a later release. Needs the game. |
| Spectators | Off, Enrolled only, or Live event (the whole platform). Built in a later release. Off by default. |

A feature needs the master switch, and spectators and the ladder need the game. Turning a switch off turns off what depends on it in the same row.

### Rules of play (instructors for their own course, or a Super Admin anywhere)
Set on the course page (Ayakbi Arena rules) or in `/admin/arena`.

| Rule | Default | Limits |
|---|---|---|
| Seconds per question | 15 | 5 to 120 |
| Seconds to pick a number | 10 | 5 to 60 |
| Bonus for a stolen question | 50% extra | 0 to 200 |
| Pauses per player | 2 | 0 to 3 |
| Longest pause | 60 s | 15 to 300 |
| Questions per match | 10 | 4 to 20 |
| Ticking sound | on | |

The other player has a fixed **5 seconds** to answer a question the first player missed. A stolen question is worth the normal points plus the bonus share (an 80-point question is worth 120 at 50%).

Numbers are clamped into their limits on the server. Instructors can only change the rules, never the switches (the API refuses anything else). A course owner, someone the course is shared with for editing, and a Super Admin can change a course's rules; nobody else.

### Real-time connection
`src/lib/arena/realtime.ts` is the only file that knows about Ably. Browsers can only subscribe; every message is sent by the server after it checks the rules, and messages carry no answers (they only say "something changed, fetch the latest"). Pages receive a short-lived token from `GET /api/arena/realtime/token` that lets them listen on their own channel and on the arenas of courses they are enrolled in (subscribe only).

- **No key:** `ABLY_API_KEY` unset gives polling mode; the arena works, pages check every second or two.
- **With a key:** instant updates. Create the key in the Ably dashboard with Publish, Subscribe, History and Presence, restricted to the channels `aaicbi:*`, and set `ABLY_API_KEY` in Vercel.
- **Test:** `/admin/arena` has a "Test the connection" button that sends a message and reads it back.

Channels: `aaicbi:arena:user:<traineeId>`, `aaicbi:arena:course:<courseId>`, `aaicbi:arena:match:<matchId>`, `aaicbi:arena:watch:<matchId>`.

### Data
One table, `ArenaConfig` (migration `20261112090000_arena_config`, additive). Rollback: `DROP TABLE "ArenaConfig"; DROP TYPE "ArenaSpectators"; DROP TYPE "ArenaScopeType";`.

### Checks
`tests/arenaConfig.test.ts`, `tests/arenaRealtime.test.ts`, and `scripts/device-checks/arena-settings.cjs` (switches, scopes, clamping, who may change what, token endpoint, the Super Admin page).

## Release 2: the match and the game screens

**What players do.** `/trainee/arena` lists the courses where the Arena is open; `/trainee/arena/[courseId]` shows who is online, challenges and recent matches; `/trainee/arena/match/[id]` is the full-screen landscape game (works on desktop and on a phone turned sideways, with "Flip screen" and "Full screen" buttons for locked rotation).

**Rules as built.** 15 s per question (instructor 5-120), a separate 10 s pick-a-number timer with its own message and tone (the system picks a random number on timeout), a miss passes the question to the other player for 5 s for normal points plus the bonus (default +50%), the first player's wrong pick is never sent to the other player, only the correct answer and explanation appear at the reveal, speed bonus up to 20% on a first correct answer, 2 pauses per player (60 s auto-resume, question hidden while paused, chat open), reactions only between questions (lobby, pick, reveal, end), forfeit after 3 missed turns in a row, invites expire after 10 min, lobbies after 15 min, abandoned matches after 30 min.

**How it stays honest.** The database is the source of truth. Every request loads the match, settles any deadline that has passed, applies the action and saves with a version check. Browsers receive a per-player view (`src/lib/arena/arenaView.ts`) with no answer key.

**Real time.** Ably only says "something changed". Browsers listen over a plain event stream with a short-lived subscribe-only token from `/api/arena/realtime/token` (no Ably library is shipped to phones); the page then refetches its own view. With no key, or if the stream drops, pages poll every 1-2 s.

**Checks.** `tests/arenaCore.test.ts` (rules), `scripts/device-checks/arena-match.cjs` (two trainees play a complete match through the API: challenge, lobby, pick, answer, bonus, pause, reactions, timeouts, forfeit, expiry, rate limit) and `scripts/device-checks/arena-ui.cjs` (two browsers on desktop and a landscape phone, no scrolling, no console errors).

## Release 3: play again, a minute per question, livelier game

- **Defaults:** 60 s per question (instructor 10-180), 20 questions per match (a match is as long as the course has questions when that is fewer, never below 4), 20 s for a bonus chance. Picking a number has no visible timer; `pickSeconds` (default 180) is only a safety net so a match cannot stall if someone walks away.
- **Play again:** after a match either player can ask for a rematch with new questions (the previous match's questions are skipped while fresh ones remain). If both press it, they land in one lobby. Schema: `ArenaMatch.rematchOfId`.
- **Questions and answers:** options that point at each other ("All of the above", "Both A and B") keep their written order; typed letter prefixes ("A) ...") are removed so they cannot clash with the letters the game draws. The reveal now says the correct answer in words with the explanation, and marks your own wrong pick.
- **Game feel:** 3-2-1-GO start, streak flames, score count-up, confetti and flying points on a correct answer, edge flash, winner colours on the number board, rising countdown beeps in the last 5 s, a synthesized sound kit (tick, pop, correct arpeggio, gentle miss, bonus stinger, victory/defeat/draw), 12 reactions with their own sounds, stars and a head-to-head record on the result screen, and a "review the answers" recap that puts missed questions first.

## Release 4: phones play upright

Quiz-style games on phones are played in **portrait** (Kahoot, Trivia Crack, QuizUp and Duolingo all do): one hand, thumb reach, text-heavy questions read naturally, and nobody has to turn the phone. The Arena therefore no longer asks for landscape or a "flip screen".

- **Portrait (phones):** one column. A scoreboard row (you | timer | them), the progress strip, then the question card with large full-width answer buttons; the card scrolls inside itself when a question is long and the Lock in button stays pinned at its bottom. A dock under the card holds **React** (opens a bottom sheet of 12 reactions) and **Pause**.
- **Wide screens (tablets, desktops, phones held sideways):** the three-column board as before, with a Pause button in the top bar.
- The phone layout is chosen with a plain media query on the screen's shape (`max-aspect-ratio: 1/1`), not a container query, so it also works on older iPhones (Safari before 16 ignores container queries). Container-query units keep a viewport-unit fallback. The root uses `100dvh` so mobile browser bars never cut it off.
- Pause had an API and an overlay but no button; it now has one in both layouts.
- Check: `scripts/device-checks/arena-ui.cjs`, `arena-matching.cjs` and `arena-ordering.cjs` run desktop, landscape phone and portrait phone.

- Sized for an iPhone 7 (375 x 553 visible): thin top strip, one-line progress, a 52 px scoreboard row, a question card that takes the rest, and a 34 px dock. `arena-ui.cjs` checks a 375x553 viewport: all four answers and the dock fit with nothing cut or wider than the screen.

## Release 5: drag and drop, leaving and quitting, a faster lobby

- **Ordering is drag and drop.** Hold the ⠿ handle (finger or mouse) and drag a step; the others make room, the card scrolls when you reach its edge, and the arrow keys work from the handle for keyboard users.
- **Leave the game and come back.** The 🏠 button (and Back) leaves the game screen for the normal app; if the player has a pause left the game is paused first. Anywhere else in the app, a gold pill (`ArenaReturnPill`, fed by `GET /api/arena/active`) says "Your game with X is paused/on · Return". The arena lobby no longer pushes you back into a running game; it shows a "Game on" card instead. A pause lasts the instructor's pause limit (default 60 s); after that the clock runs, three missed turns in a row forfeit, and a game nobody touches for 30 minutes is abandoned.
- **Quit from the pause screen.** Pause shows Quit game, Visit the app and Resume. Quit asks first, then the match ends, the quitter sees "You quit the game", the opponent sees "X quit the game, so you win automatically" and a message is added to the match chat.
- **Lobby list.** The topic list now uses the smallest playable pool (4) rather than the full match length, and is computed with three queries and cached for a minute instead of two queries per module on every refresh. Someone arriving is announced to the others at once, someone leaving the page drops off at once (`sendBeacon`), match screens keep a player "in the arena" so they show as busy, and online lasts 60 s instead of 45.
- Checks: `arena-lobby.cjs`, `arena-quit.cjs`, and the drag steps in `arena-ordering.cjs`.

- The practice games' **ordering** question (`GamePlayer`) is drag and drop too, using the shared `useDragReorder` hook (handle on the right, scrolls the page near its edges, arrow keys on the handle). Check: `scripts/device-checks/game-ordering-drag.cjs`.

## Release 6: course chat and moderation

- **One group chat per course**, for trainees enrolled in it, shown in the arena lobby. A Super Admin turns it on with the "Course chat" switch (it needs the arena itself to be on). Messages are up to 500 characters, rate limited, a repeat of the same text within 10 s is ignored, the latest 60 from the last 7 days are shown, older ones are deleted. A new message pokes `channels.course`, so everyone's list updates at once.
- **Moderation.** Instructors and admins who own the course get a "Chat moderation" panel under the Ayakbi Arena rules: recent messages with **Remove**, **Suspend** (1 hour to 90 days, hides the player's last 24 hours of messages) and a list of active suspensions with **Lift**. API: `GET/POST /api/admin/courses/[id]/arena/chat` (`action: remove | suspend | lift`).
- **Suspension** (`ArenaSuspension`) stops a trainee from posting, challenging and accepting challenges in that course; the lobby tells them why and until when. Removals keep the row (`deletedAt`, `deletedById`) as a record.
- Check: `scripts/device-checks/arena-chat.cjs` (post, live delivery, removal, suspension).

## Release 7: Ayakbi Arena chat, challenges and Fastest Fingers

- **Name.** The game and the arena are now called **Ayakbi Arena** everywhere trainees and staff see them.
- **Chat page and course page.** `/trainee/arena/[courseId]/chat` is the chat on its own full page. Course pages show a "Course chat" card (`CourseChatLink`, fed by `GET /api/arena/courses/[courseId]/chat`) when the chat is open for that trainee. Reactions (the same twelve as in a match) are one tap and post a large emoji.
- **Phone notifications.** Each new chat message sends a web push to the other enrolled trainees who allowed notifications (`pushToCourse`; one message alert per person per course every 20 seconds, so a busy chat does not flood). Challenges and Fastest Fingers questions always notify. A tap opens that course's chat.
- **Online anywhere.** Anyone signed in with the app open counts as online in the arenas of their courses (`/api/arena/active`, every 25 s).
- **Challenges in the chat.** The ⚔️ button lists who is online. A challenge (from the chat or the lobby) is posted as a card (`ArenaChatMessage.kind = CHALLENGE`, `refId` = match). The challenged trainee accepts or declines on the card; the card follows the match status.
- **Fastest Fingers.** Off until a Super Admin switches on "Fastest Fingers" (needs the chat; `fastestEnabled`, default off). An instructor or admin who owns the course posts a question (picked from the approved practice questions, or typed with 2 to 6 answers) with 1 to 100 credits (`/api/admin/courses/[id]/arena/sprint`). It appears in the chat as a card; everyone gets one try; the first right answer is decided by one atomic update, wins the credits and is announced. The answer key is not sent while the question is open. Starting a new question closes the old one; the instructor can close one with no winner.
- **Credit scores.** `ArenaCredit` is a ledger (one row per award, unique per trainee, reason and reference). The chat shows the trainee's total for the course. Nothing spends credits yet.
- Checks: `scripts/device-checks/arena-chat-cards.cjs`.
- On small phones (portrait, under 700 px tall) the chat is compact: the reaction row folds into one 😀 button that opens a tray, challenge cards are one line and Fastest Fingers answers sit in two columns.

## Release 8: one Messages button

The floating Messages button (trainee pages with the sidebar) is now one inbox (`MessagesPanel`): **course group chats** (the Ayakbi Arena course chat, opened inside the button with its challenge and Fastest Fingers cards, plus a "Full chat" link), the existing **cohort chats**, and **direct messages** with instructors, admins and coursemates, with a ＋ New message picker (the existing `/api/conversations/contacts` and `/direct` rules apply: only people from your own courses and cohorts). The button's badge adds up unread direct, cohort and group messages. Unread group messages are tracked per trainee in `ArenaChatRead` (`/api/arena/chats`, `/api/arena/courses/[courseId]/chat/read` and `/thread`). "Share to Showcase" stays as the second tab. Check: `scripts/device-checks/messages-inbox.cjs`.

## Release 9: challenge notifications

- **Challenged player.** A new challenge (or rematch request) adds an entry to their notification bell (`ARENA_CHALLENGE`) and sends a push to their phone, even when they are somewhere else in the app and whether or not the course chat is on. The wording and links are in `challengeNotifyCore.ts` (tested).
- **On screen.** The gold challenge bar that shows on every page now has **Accept** and **Decline** on it (`ArenaReturnPill`), so a challenge can be answered without opening the game first. It checks every 25 seconds.
- **Challenger.** When the other player accepts or declines, the challenger gets a bell entry and a push ("X accepted your challenge", "X declined your challenge"). Answering clears the invitation from the other player's bell.
- Check: `scripts/device-checks/arena-challenge-notify.cjs`. Not covered: a "no answer" notice when an invitation expires, and a per-person mute for these alerts.

## Release 10: chat alerts on the home page and the app icon

- **Home page card.** On the feed and the dashboard, each course group chat with unread messages shows a "Chat is live" card (up to two, then "and N more") with the course, a preview and a "N new" pill, **Open chat** and **Later** (`ChatAlerts`, mounted once in the root layout). It asks `/api/arena/alerts` every 20 seconds while the page is visible and when the tab comes back.
- **App icon number.** The installed app's icon (Badging API) and the browser tab title (`(3) …`) carry the total of unread group messages, unread direct and cohort messages, and a waiting challenge. Reading the chat counts it down. When a push arrives with the app closed, the service worker sets the icon number from the push (`badge`, the course's unread count; the app corrects it to the full total next time it opens).
- iPhones show the icon number only for an app added to the home screen with notifications allowed (iOS 16.4+).
- Check: `scripts/device-checks/chat-alerts.cjs`.

## Release 11: champion ladder and the credit wallet

- **Champion ladder** (Super Admin switch "Champion ladder", off until switched on). Each course has its own ladder at `/trainee/arena/[courseId]/ladder`: a podium for the top three, everyone below with tier and movement, and your own place pinned at the bottom with a bar to your next tier. Boards for This week, This month and All time. Challenge a player who is online straight from the list.
- **Rating.** Elo: everyone starts at 1000, K = 32, so an even match moves about 16 and no match moves more than 32. Tiers: Bronze (under 1000), Silver (1000), Gold (1200), Platinum (1400), Champion (1600). Pure rules and tests in `ladderCore.ts`.
- **Counting.** A finished match (`COMPLETED`, or `FORFEITED` including a quit, never an abandoned one) moves both ratings once (`settleLadder`, safe to run twice). A quit counts as a loss. The same two players count for at most 3 matches a day; further ones show "Not counted". A player appears after 5 counted matches. Instructors can take a player off the ladder and put them back (course settings, "Champion ladder"); the rating is kept.
- **Result screen** shows the points won or lost, the new total, any tier-up, the place on the ladder and the distance to the next tier. The lobby shows your tier and place at the top, and a tier and crown next to each player.
- **Weekly champion.** The best counted weekly gain of the week before (at least 3 counted matches, gain above zero) is found the first time anyone looks after the week turns, recorded once (`ArenaChampion`), announced in the course chat with a push to everyone, and crowned 👑 for the week. Ratings are never reset: the champion's points stay.
- **Credit wallet** (separate Super Admin switch "Credit wallet", **off**). Credits come from Fastest Fingers and are a ledger (`ArenaCredit`). With the switch on, a trainee can send credits to a coursemate from the ⭐ button in the chat (1 to 100 at a time, 300 a day, never more than they have; two sends at once cannot spend the same credits twice; the receiver is notified). `spendCredits` is the single place credits will leave a wallet for platform features; nothing calls it yet. Ladder points are a rank and are not spendable or transferable.
- Check: `scripts/device-checks/arena-ladder.cjs` (settle once, result screen, ladder page, lobby tier, weekly champion announced once, wallet off then on, overspend and double-send refused). Not browser-tested: the wallet sheet in the chat, and the ladder admin list.

## Release 12: challenge anyone, reach them on their phone

- **Anyone in the course can be challenged**, not only people who are in the arena. The lobby's "Not online" list, the chat's ⚔️ list and the ladder all offer every coursemate. An invitation to someone who is away waits 60 minutes (10 when they are online).
- **Phone notification.** The challenged player gets a bell entry and a web push that shows on their home screen or lock screen even with the app closed. A challenge push is `urgent`: it stays on the screen until tapped and buzzes the phone (`requireInteraction`, `vibrate` in `sw.js`). Tapping it opens the match, where they accept or decline.
- **Telling the challenger how it will reach them:** "Challenge sent. X gets a notification on their phone", or "X hasn't turned on phone alerts, so they'll see it next time they open the app".
- **Turn-on nudge.** A trainee without phone notifications sees a "Get challenges on your phone's home screen, Turn on" card in the lobby and the chat (`PushNudge`); on an iPhone it asks them to add the app to the home screen first (iOS 16.4+). Real push needs the VAPID keys set in production.
- Check: `scripts/device-checks/arena-challenge-notify.cjs` (also a challenge to someone with no presence at all).

## Release 13: spectators and live events

- **Spectating** (the existing Super Admin "Spectators" switch: Off, Enrolled, or During live events only; `spectatorCap` limits watchers per match). The lobby has a "Live now" card with each live match, its score, how far along it is and how many are watching, with a **Watch** button (`/trainee/arena/watch/[id]`). A watcher sees the scoreboard, the clock and the question, but the answer appears only when the round is revealed (`spectate.ts` reads the match as the challenger sees it and drops everything private, including the players' chat). Watchers cheer with five emojis (`ArenaCheer`, one per 0.8 s); nothing typed reaches a player. Players see "👁 N" and the cheers float up their screen. Players cannot watch their own match; suspended trainees cannot watch. A full match says so.
- **Live events** (new Super Admin switch "Live events", **off**, needs the game). An instructor opens an event from the course settings ("Live events": name, questions per match), which pushes to the course. Trainees join from the lobby banner. **Start** seeds a single knockout by ladder rating (strongest players meet last; byes for odd numbers go to the top seeds, `eventCore.ts`), puts each pair in a match lobby (`ArenaMatch.eventId`, so event matches count on the ladder and can be watched) and notifies the two players with an urgent push. Winners move on and the next tie is called when both players are known; the final crowns the champion, announced once in the chat with a push. A draw is replayed with fresh questions. A player who has not tapped Ready within 3 minutes loses (nobody ready: the better seed goes through), and the instructor can settle a pairing by **walkover** or cancel the event. Players who are out become the audience.
- **Pages.** `/trainee/arena/[courseId]/event/[eventId]` (bracket, now playing, your place, Join/Leave, Watch links) and the instructor's big screen `/admin/courses/[id]/arena-event/[eventId]` (the same view, larger type, for a projector).
- Not included: round-robin or Swiss pairings, ending an event early with a winner by rating, a spectator delay, and cheers shown on the big screen.
- Check: `scripts/device-checks/arena-spectate.cjs`.

## Release 14: "nobody answered" notice

- When a challenge runs out unanswered (10 minutes if the other player was online, 60 if they were away), the **challenger** gets a bell entry and a push: "X didn't answer your challenge. Challenge again, or message them in the course chat." The invitation is also taken off the other player's bell (`notifyChallengeExpired`). Live event pairings are not invitations and send nothing.
- Nothing runs the instant an invitation lapses, so whoever is using the app settles lapsed invitations (`sweepExpiredChallenges`, at most every 30 seconds per server, called from `/api/arena/active`), and a daily job `/api/cron/arena-sweep` (`CRON_SECRET`, in `vercel.json`) is the backstop. In practice the notice arrives within about a minute while anyone is in the app, and by the next morning at the latest on a quiet day.
- Check: `scripts/device-checks/arena-challenge-notify.cjs` (expiry, told once, cleared from the other bell).

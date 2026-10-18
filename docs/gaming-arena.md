# Gaming Arena

Two trainees challenge each other on a course, live. This page describes what is built; the full plan is in the product brief.

## Release 1: switches, rules and the real-time connection

### Switches (Super Admin, `/admin/arena`)
Everything is **off** until a Super Admin switches it on. Settings are kept per scope: the whole platform, one organization, or one course. The narrowest scope that sets a value wins; a value left blank follows the wider scope.

| Switch | What it does |
|---|---|
| Gaming Arena | Master switch. Nothing works while it is off. |
| Two-player Interview game | Challenges, lobby, match, results, rematch. Needs the master switch. |
| Course chat | Built in a later release (the switch is shown but disabled). |
| Champion ladder | Built in a later release. Needs the game. |
| Spectators | Off, Enrolled only, or Live event (the whole platform). Built in a later release. Off by default. |

A feature needs the master switch, and spectators and the ladder need the game. Turning a switch off turns off what depends on it in the same row.

### Rules of play (instructors for their own course, or a Super Admin anywhere)
Set on the course page (Gaming Arena rules) or in `/admin/arena`.

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

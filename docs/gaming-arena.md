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

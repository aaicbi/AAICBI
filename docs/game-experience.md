# The animated game experience

Practice and games (not the formal exam) play as short **rounds of 10 questions** with a welcome, a countdown, a live heads-up display, Loop as the companion, and a summary. It changes how practice looks and feels. It does not change scoring, XP, mastery, the streak of practice days, the database, sign-in or exam rules: every result still comes from the server, and the round only reacts to it.

## What the learner sees

1. **Welcome.** Loop says hello and the learner taps "Let's go". The first round of a visit adds a skippable **3, 2, 1, GO**; later rounds go straight in. No question is requested until the countdown ends, so it never eats into thinking time.
2. **Each question.** The question rises in and the options follow one after another. A heads-up display shows "Question n of 10", a progress bar, one pip per answer (with an icon as well as a colour), the number correct, XP earned this round (only when XP was really paid) and, from three correct in a row, a streak badge.
3. **After answering.** A correct answer pops and glows; a partly right or missed answer gets a short, calm shake and a supportive message. Loop's face and message change with the result. Messages are picked at random from a set and never repeat twice in a row. Strong effects are kept for moments that earned them: confetti for three and five in a row and for a high round.
4. **Summary.** An animated score ring with the real accuracy, the counts, a message that fits the result, any achievements actually earned, a list of every answer to review (with the right answer where it was missed), and "Play another round" or "Back".

Words are warm and never say pass or fail: practice has neither.

## Honest by design

- Accuracy is the share right across the round (a partly right matching or ordering answer counts by how much of it was right). Nothing is added for show.
- The **streak** here is consecutive fully correct answers within the round, shown only as presentation. It is separate from the practice-day streak and from streak XP, which the server still decides.
- **Achievements** are only for things that really happened: three in a row, five in a row, a flawless round, 90% or more across a full round, and finishing a full round with three or more to revisit. They are not saved.
- The round counts an answer once even if it is reported twice.

## Sound

Off by default. A visible switch in the heads-up display turns it on; the choice is remembered on that device. Sounds are tiny tones made in the browser (no files, no libraries) and only play after the learner has tapped something, as browsers require.

## Accessibility and performance

- Motion is transform and opacity only, short, and each piece is tied to a real moment. With "reduce motion" set in the device, animations collapse, there is no confetti and the countdown is shorter.
- Everything works by keyboard. Loop's message is announced politely; the countdown is announced. Pips carry text labels, not only colour.
- No animation libraries were added: it is CSS keyframes, a small confetti drawn from page elements that remove themselves, and the Web Audio tones.

## Where it lives

| Piece | File |
| --- | --- |
| Round rules, messages, achievements (pure, tested) | `src/lib/games/experience.ts` |
| Sound pref and tones (pure, tested) | `src/lib/games/sound.ts` |
| Round state | `src/components/games/experience/useRound.ts` |
| Wrapper around the game player | `src/components/games/experience/GameRound.tsx` |
| Intro, HUD, companion, summary, confetti, counter | `src/components/games/experience/*` |
| Animations | `src/app/globals.css` (classes starting `gx-`) |
| Game player hooks (optional) | `src/components/games/GamePlayer.tsx` |
| Practice round | `src/app/trainee/courses/[id]/modules/[moduleId]/practice/page.tsx` |
| Game round | `.../games/[gameId]/page.tsx` |
| Sample games | `src/components/games/demoData.ts`, page `/admin/studio/demo` |

## Seeing it without building anything

Staff can open **Game Studio → Play the sample games** (`/admin/studio/demo`): ten sample items in each format (quiz, matching, ordering, scenario). Nothing is saved and no XP is paid. Matching, ordering and scenarios are graded by the same functions the server uses.

The Game Studio preview and the formal exam are unchanged, apart from small answer animations in the preview.

## Tests

`tests/gameExperience.test.ts`, `tests/gameSound.test.ts`, `tests/gameDemo.test.ts` and the browser check `scripts/device-checks/game-experience.cjs` (phone, tablet, desktop, every format, sound memory, keyboard, reduced motion, and the summary matching the answers shown).

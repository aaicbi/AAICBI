---
name: module-content
description: Turn the lesson files attached to a message (PDF, Word, PowerPoint) for ONE module into a reviewed set of game and practice content for the AAICBI platform: 20 quiz questions, 20 matching sets, 20 ordering sequences and 20 scenarios per learning objective, written by one Claude model and blind-reviewed three times by a different one. Use when the user attaches module materials and asks for the games, questions or "the same process as Module 1".
---

# Module content: materials in, reviewed game content out

This is the exact process used for AI Automation Fundamentals, Module 1 (result in `content/ai-automation/module-1*`). Follow it in order. Keep status lines to the user short. Never open a PR or merge unless asked.

## What the user gets
`content/<course-slug>/<module-slug>.json` (items; the filename must end in `.json`), `...-source.md` (the text they came from) and `...-REPORT.md` (counts + how it was checked), committed and pushed to the session branch. Nothing goes live: the file is loaded into the platform with the studio's **Import reviewed content** panel (Game Studio → pick the module), which shows what would be saved first; quiz questions arrive as "passed review" and the other items as drafts, so a person still approves.

Targets per objective: quiz 20, scenario 20 (exact), matching 16-20, ordering 10-20 (drop weak items, never pad with reskinned duplicates; the platform minimum is 10 per format). Games play in rounds of 10 drawn at random from this pool.

## Step 0: set up a work folder
`WORK=<scratchpad>/<module-slug>` (use the session scratchpad). Run every script from inside `$WORK`. Scripts live in `.claude/skills/module-content/scripts/`.

## Step 1: read the materials and split them by module
`python3 scripts/extract.py $WORK/source.md "Label=path[:range]" ...` (pptx range = slides, pdf range = pages). Read the whole of `source.md`.
Materials often cover several modules (e.g. one notes file for Modules 1-2): include ONLY the parts that belong to the user's module, and say which parts you held back.

## Step 2: draft the objectives and get them confirmed (do not skip)
Write objectives from the materials, 6-10 per module, each one a testable skill with the concrete examples/terms the materials give. If the materials list objectives, use those and add any gaps the PDF/slides cover. Show the list, say items = objectives x 80, and WAIT for the user to confirm or edit. Save the confirmed list as `$WORK/objectives.json` (JSON array of strings).

## Step 3: write (parallel, one agent per objective)
Spawn one `Agent` per objective, `model: sonnet`, all in one message. Prompt: `prompts.md` → "Writer". Each writes `$WORK/objN.json` and runs `validate.py` until OK. Their one-line notes about unclear or contradictory source facts go in the final report.

## Step 4: blind review, pass 1
`python3 scripts/packet.py <seed>` (answer-free packets in `$WORK/review/`, private keys outside it). Spawn one `Agent` per objective, `model: opus` (a DIFFERENT model from the writers), in one message. Prompt: "Reviewer". The reviewers must only touch `review/`.
Then `python3 scripts/score.py` → `fixlistN.json` per objective.

## Step 5: fix, then repeat the review
`SendMessage` each writer (they resume with context) using "Fix message". Then `validate.py`, `packet.py <new seed>` (move the old `review/` aside first, e.g. `mv review r1`; `packet.py` recreates it), review again, score again. Do three review passes (first pass flagged 261 of 640 items, then 125, then 59). Stop when remaining flags are only minor, and use judgement: orderings the source does not really fix should be DELETED, not rewritten.

## Step 6: disputed answers
After each pass, quiz/scenario answer mismatches are NOT sent to writers. Run `python3 scripts/tiebreak.py build`, spawn one `opus` agent with the "Tie-break" prompt, then `tiebreak.py check`. In Module 1 the writer's key was right on all 35 disputed items (reviewers had mis-aligned or guessed). Only fix items where the tie-break also disagrees with the key.

## Step 7: last gate on changed items
Re-review only the items changed in the final round (diff the packets), blind, in one or two agents. Apply their last flags: delete or fix.

## Step 8: clean up
- Remove near-duplicates across objectives (same ordering reworded, same example): keep one. Same-skill arithmetic with different numbers is fine.
- Apply every deletion to the `objN.json` files themselves, re-run `validate.py`, then `python3 scripts/assemble.py "Course" "Module" $WORK/module.json` (prints the counts table).

## Step 9: publish and report
Copy `module.json` and `source.md` into `content/<course-slug>/` with a `-REPORT.md` (counts table, how checked, honest shortfalls and why, known limits, source inconsistencies the writers noted). Branch rules: if the session branch's PR was merged, restart it from `origin/main` first; push with `git push -u origin <branch>`; if it is rejected because the remote still holds old merged history, `git merge -s ours origin/<branch>` then push (do not force-push). Commit trailers as the session requires. Then go to Step 10.

## Step 10: tell the user how to load it
The import is built (see `docs/game-studio.md`, "Importing reviewed content"). Tell the user, in order: (1) once the branch is merged and deployed, open the Game Studio, pick the module, and under **Import reviewed content** choose `content/<course-slug>/<module-slug>.json` (they can download it from the repo); (2) check the preview and click Import; (3) approve the quiz questions in the question bank (Games and practice tab, "Approve all that passed") and the drafts in the studio; (4) switch the games on. The module must already exist in the platform; objectives are matched by words and any missing ones are added. Then give the counts, shortfalls and limits, and ask whether to send the next module.

If you change the file format (`schema`), update `src/lib/quest/contentImport.ts` and its tests (they read the Module 1 file as the fixture) and re-run `scripts/device-checks/content-import.cjs`.

## Lessons from Module 1 (apply them)
- Reviewers sometimes answer wrongly in runs (mis-aligned ids). Never trust a lone disagreement: tie-break first.
- The commonest real defect is the "giveaway": the correct option is longer/more detailed than the distractors. Tell writers to match length within ~20% and keep distractors plausible.
- Orderings are the hardest format: materials rarely fix real sequences. Don't ask for 20 where the source supports 11.
- Writers repeat templates (same ordering reskinned). Flag and delete.
- Models can hit a rate limit mid-run: finished result files are usually already saved on disk, so check `review/resultN.json` before relaunching.
- Always keep objectives tied to the materials; items must never need outside facts. Use Nigerian small-business settings like the materials do. Never use the words "pass"/"fail" in learner-facing text.

# Prompt templates (fill in the paths and numbers)

## Writer (one per objective, model sonnet)
You are writing assessment/game content for AAICBI's "<COURSE>" course, <MODULE>. Work ONLY from the source file <WORK>/source.md (read it fully first). Do not use outside knowledge for facts; every question must be answerable from that file. Do not touch any other files except the one you write.

YOUR OBJECTIVE (number N of M; the others are written by other agents, stay on yours): see objective index N-1 in <WORK>/objectives.json (print it with a shell command).

Write exactly 80 items for this objective into <WORK>/objN.json as ONE JSON object with four arrays: "quiz" (20), "matching" (20), "ordering" (20), "scenario" (20). Formats:
- quiz item: {"question": str, "options": [4 distinct strings], "correct": 0-3, "explanation": str}. Exactly one clearly best option; plausible distractors drawn from real misconceptions in the material; no "all/none of the above"; vary which position is correct.
- matching item: {"prompt": str, "pairs": [{"left": str, "right": str} x 4 or 5]}. Every left and right unique within the item, each right matching exactly one left unambiguously.
- ordering item: {"prompt": str, "steps": [4 to 6 strings in the CORRECT order]}. Only sequences with a genuine order stated or clearly implied in the material.
- scenario item: {"situation": str, "options": [{"text": str, "outcome": str, "correct": bool} x 3 or 4]}. Exactly one correct. Outcome is one or two sentences saying what would happen and why, so a wrong choice teaches. Use Nigerian small-business or workplace settings like the material does.

Quality rules: all four formats test THIS objective only. Mix difficulty: roughly 40% recall, 40% understanding/application, 20% analysis/judgement. Spread coverage across every fact and idea the material gives for this objective. All 20 items per format must test different things (no near-duplicates, no reusing the same example for more than two items). The correct option must NOT be longer or more specific than the distractors (similar length, similar detail, distractors plausible not absurd). Plain, beginner-friendly English, no trick questions. Text limits: every question/option/pair/step text <= 300 characters, prompt/situation <= 800. Do not use the words "pass" or "fail". Do not mention the source file or "the material" inside items.

Then run: python3 <SKILLS>/scripts/validate.py <WORK>/objN.json and fix until it prints OK. Reply with only: "objN done" and any facts in the material you found unclear or contradictory (one line each).

## Reviewer (one per objective, model opus, never the writer's model)
You are an independent reviewer of training-assessment items. Work ONLY inside <WORK>/review/ . Do not read, list or open any file outside that folder (other folders hold answer keys you must not see). Read source.md (the only truth), objectiveN.txt (the learning objective every item must test), and packetN.json (80 items with NO answer keys).

PART 1 - answer every item yourself, from source.md only. Work through the items one at a time and think each through; do not pattern-guess, and double-check that the id of each answer matches the item you answered:
- quiz (id q0..): 0-based index of the best option, or -1 if none is supported by the source or more than one is defensible.
- matching (m0..): the list of rights, in the same order as "lefts", that correctly match each left according to the source (exact right strings; "?" for a pair the source does not settle).
- ordering (o0..): the steps in the correct order (exact strings), as the source states or clearly implies; null if the order is not determined by the source.
- scenario (s0..): 0-based index of the best option, or -1 if none/ambiguous.
PART 2 - flag real problems only (strict but fair, no trivia): {"id","kind","reason"} where kind is one of: "unsupported", "ambiguous", "off_objective", "duplicate" (name the other id), "giveaway" (correct option obviously longer/more specific, or wording gives it away), "unclear", "factual".
Write ONE JSON file <WORK>/review/resultN.json shaped {"answers":{"q0":1,"m0":[...],"o0":[...],"s0":2,...},"flags":[...]} covering all 80 ids, check it parses, then reply with only "reviewN done" and the number of flags.

## Fix message (SendMessage to each writer after scoring)
A second independent review flagged the items in <WORK>/fixlistN.json (id q3 = quiz[3], m = matching, o = ordering, s = scenario; zero-based). Revise objN.json: fix or REPLACE each listed item (always replace/delete for duplicates, unsupported and off_objective). For "giveaway" make the correct option the same length and level of detail as every distractor (within about 20%), distractors plausible. For orderings whose order the source does not fix: replace ONLY with a sequence the source genuinely fixes and that tests this objective, otherwise DELETE the item (matching may drop to 16, ordering to 10; quiz and scenario stay at exactly 20). Do not touch unlisted items. Run validate.py until OK, then reply only "objN revised" and the new counts of matching and ordering.

## Tie-break (one agent, model opus)
You are an independent checker of multiple-choice items. Work ONLY inside <WORK>/tiebreak/ . Read source.md (the only truth) and packet.json. For each item decide which option is the single best answer according to source.md, thinking it through carefully one item at a time (no pattern-guessing). Write <WORK>/tiebreak/result.json as {"answers":{"<id>":<0-based option index or -1>,...},"notes":{"<id>":"<one short reason; say if two options are defensible>"}} for all ids. Check it parses, then reply only "tiebreak done".

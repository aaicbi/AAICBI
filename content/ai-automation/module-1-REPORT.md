# AI Automation Fundamentals, Module 1: content and quality report

File: `module-1.json` (600 items across 8 learning objectives). Source texts: `module-1-source.md`
(the Module 1 PDF handout, the Module 1 half of the Student Lesson Notes, and the Module 1 slides of the Practical Steps deck).

## Counts per objective

| # | Objective | Quiz | Matching | Ordering | Scenario |
|---|-----------|-----:|---------:|---------:|---------:|
| 1 | What automation is and is not | 20 | 19 | 17 | 20 |
| 2 | Manual vs automated; strong vs weak candidate | 20 | 20 | 13 | 20 |
| 3 | AI and AI automation vs rule-based automation | 20 | 20 | 18 | 20 |
| 4 | Trigger, action, workflow | 20 | 19 | 19 | 20 |
| 5 | No-code tools and why they exist | 20 | 20 | 11 | 20 |
| 6 | The six beginner mistakes | 20 | 19 | 16 | 20 |
| 7 | Business value of automation | 20 | 20 | 18 | 20 |
| 8 | Preparing a first workflow; manual vs automated chart | 20 | 18 | 13 | 20 |
| | Total | 160 | 155 | 125 | 160 |

Quiz and scenario reach the target of 20 for every objective. Matching is 18 to 20. Ordering is 11 to 19: the source gives
real sequences for only some ideas, and ordering items without a sequence the source fixes were removed rather than padded
(objective 5 has one genuine build sequence; objectives 2 and 8 overlap on the chart steps). Every objective is still at or
above the platform minimum of 10 per format.

## How it was checked

1. Written from the source only, one objective at a time, by one Claude model, with an automatic structure check.
2. Reviewed three times by a different Claude model that answered every item blind (without the answer key) from the source and flagged
   ambiguity, wording that gives the answer away, unsupported facts, off-objective items and duplicates.
   Flags fell from 261 items (first pass) to 125 to 59. Disagreements were fixed or the item replaced or removed.
3. Disputed answers were settled by a further blind check with the options shuffled: the key was confirmed on all 35 disputed
   scenario items. The 24 items changed in the last round were re-reviewed blind with no answer disagreements.
4. Cross-objective duplicates were removed (five repeated orderings).

## Known limits

- Reviewed by AI only; a human should skim the items before they go live (the studio approval step is built for this).
- A few correct options may still be somewhat longer than the distractors.
- The source gives several lists (for example the manual tasks in the registration example) without any order, so ordering items about those were avoided.
- Source wording differences noted by writers: the PDF slide lists six beginner mistakes while the lesson summary names five;
  "task" (a Zapier term) is not in the Module 1 PDF and is treated as Module 2 content.

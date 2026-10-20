# AAICBI Ecosystem user manuals

Two manuals (Training Organisation, Trainee) and a combined edition, built from editable source files.

## Files

| Path | What it is |
|---|---|
| `src/content/org-*.cjs`, `trainee-*.cjs` | The text of every chapter. Plain JavaScript that calls helpers (`task`, `steps`, `pair`, `table`, `tip`, `warn`, `note`). Edit these to change wording. |
| `src/content/common.cjs` | Glossary and the "Getting help" text (the support-contact placeholder lives here). |
| `src/lib.cjs`, `src/style.css` | The building blocks and the page design (colours, fonts, callouts, numbered steps). |
| `build.cjs` | Builds the PDFs into `output/`. `node docs/manual/build.cjs [org|trainee|combined]` (no argument builds all three). |
| `capture.cjs`, `shots*.json`, `run-capture.sh` | Takes the real screenshots from the running app (computer 1440 x 900, phone 390 x 844, dark theme). `shots-annotated.json` also records where each numbered mark goes. |
| `screenshots/` | The captured screens, grouped by audience: `shared/`, `org/`, `trainee/`. A `.json` beside a screenshot holds its numbered marks. |
| `output/` | The finished PDFs. |

## Rebuilding

1. Start the app on port 3113 against the demo database (see `scripts/device-checks/README.md`).
2. `docs/manual/run-capture.sh` retakes every screenshot and the marked ones.
3. `node docs/manual/build.cjs` builds the three PDFs.

Screenshots use demonstration accounts and sample data only. Do not point the capture at a real database.

## Updating after the platform changes

Change the wording in `src/content`, retake the affected screenshots (`SHOTS=shots2.json node docs/manual/capture.cjs org/course`), bump `VERSION` and `DATE` in `build.cjs`, add a row to the revision history there, and rebuild.

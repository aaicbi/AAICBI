# Loop Command Center

The Super Admin's assistant, redesigned to work like Claude: saved conversations, replies that stream in
and are formatted, files attached to the chat, suggested starting prompts, and a level that sets how much
Loop may do on its own.

Where things are: page `src/app/admin/command/page.tsx` and `src/components/command/`; engine and rules in
`src/lib/loop/` (`engine.ts`, `actions.ts`, `policy.ts`, `runAction.ts`, `attachments.ts`); routes under
`src/app/api/admin/loop/` (`chat`, `conversations`, `actions`).

## Thinking versus doing

- **Thinking, reading, writing, planning**: not limited. Loop answers anything as Claude would, and reads
  real platform data and documents through tools.
- **Changing something**: only through the **actions** in `src/lib/loop/actions.ts`. Claude never writes
  anything itself. It names an action; the server validates it, writes a plain-words summary, and the
  chat's level decides whether it runs now or shows an approval card.
- Loop can do exactly what its tools and actions allow, no more. If a request has no tool, it says so.
  New abilities are added by adding tools and actions.

## The three levels (picked per chat, like a model in Claude)

| Level | Name | What happens to a change |
| --- | --- | --- |
| 1 | Ask first (default) | Every change waits for your approval on a card. |
| 2 | Balanced | Low-risk changes happen at once (objectives, question pools, practice settings, drafting and validating questions). Messages to people and account actions ask first. |
| 3 | Autonomous | Changes happen at once. A message to more than 25 people is still confirmed. |

Every action, run or proposed, is recorded (`LoopPendingAction`) with its exact input, who it was for,
and whether it ran automatically. Approving runs exactly the recorded input.

## Actions today

Save learning objectives · draft exam questions · validate pending questions · split question pools ·
change practice settings · send a message (recipients come only from Loop's own `resolve_recipients`
lookup, never from what Claude types) · suspend messaging (the trainee comes only from conversations Loop
read). No action deletes anything.

## Reading documents

`src/lib/parsing/anyDocument.ts` reads Word, old Word, PDF (text), PowerPoint (slides and speaker notes),
Excel, and plain text by looking at the file's own bytes. Used for module materials
(`read_module_materials`) and for files attached to the chat. Not readable: videos (no transcript),
scanned PDFs (no text), and files over 4 MB attached in chat (a hosting limit; add large files to the
module as materials instead). Pictures attached to the chat are shown to Claude directly.

## Who can use it

Super Admin only today. Every other role keeps its existing, narrower Loop guide. The foundation for
giving other roles a scoped chat is in place (`User.loopLevel`, per-conversation level, per-user
conversations); the scoped tool sets per role are not built yet.

## Settings

- `LOOP_MODEL` (optional environment variable): the Claude model Loop uses. Defaults to
  `claude-sonnet-4-5`, the model the rest of the platform already uses.
- `ANTHROPIC_API_KEY`: required, as before.
- Vercel function time limit: a reply stops after 60 seconds, so very long multi-step requests are cut
  and Loop offers to continue.

## Not built yet

- Scoped chats for organization staff, trainees, employers and investors, and the Super Admin control to
  raise another person's level.
- Broader reading tools (Loop reads through a fixed, reviewed set of tools, not arbitrary database access).
- More actions (publish a course, approve a job posting, and so on).
- Reading videos and scanned PDFs.

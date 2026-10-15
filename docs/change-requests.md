# Change requests

A way for staff to ask for changes to the platform and for a Super Admin to hand the approved ones to Claude Code.

Page: `/admin/requests` (sidebar, near the top, shown to Super Admins only). API: `/api/admin/requests`.

## Flow

1. **Anyone on staff** (admin, instructor, organization staff, Super Admin) writes a request: a title, the details, and optionally the page. It is saved as *Waiting for approval*. Staff see only their own requests.
2. **A Super Admin approves or declines it**, with an optional note of what was agreed. Only a Super Admin can; a push from Loop cannot.
3. **Approved requests are the hand-off.** The Super Admin presses *Copy for Claude Code* (or *Download .md*) and pastes the brief into a Claude Code session. The brief says what each request is, who asked, who approved it and what was agreed, and tells Claude Code to open a pull request and not to merge or deploy.
4. After the pull request is merged the Super Admin marks the request *Done* and can add the pull request link.

Nothing here changes the platform by itself. Claude Code only works when a session is running, and a person reviews and merges every change.

## Loop

Loop has one action, `log_change_request`. It saves a request as *Waiting for approval* and nothing more, whatever autonomy level is set, so Loop can never approve a request. Only the Super Admin's Loop has it; staff cannot be given it.

## Optional: open a GitHub issue on approval

If these are set in the environment, approving a request also opens an issue labelled `super-admin-approved`:

- `CHANGE_REQUEST_GITHUB_REPO` — `owner/repo`
- `CHANGE_REQUEST_GITHUB_TOKEN` — a token that may create issues in that repository

The token is read from the environment only and is never shown or stored. If either is missing, or GitHub refuses, approval still works and no issue is opened. The request text is sent to GitHub only at the moment a Super Admin approves it.

## Data

`ChangeRequest` (migration `20261108090000_studio_permissions_change_requests`). Links stored for issues and pull requests must be web links.

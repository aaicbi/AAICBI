# The review team

The super admin and the staff they appoint as **reviewers** decide posts, appeals and Loop's questions from one inbox, `/admin/review`. A reviewer can escalate an unusual case to the super admin.

**Reviewers**
- A reviewer is a staff member (admin or instructor) with the **Reviewer** switch on in `/admin/staff`. Only a super admin can switch it on or off; it takes effect at once. A training organization's own staff account can never be a reviewer.
- Checked on the server for every action (`requireReviewer`), not only by hiding buttons. Reviewers see a "Review inbox" item in the sidebar.
- A reviewer **cannot** reach Loop's settings, the Claude consultant or AI-feature guidance. Those stay super admin only, and `tests/reviewAccess.test.ts` fails if a review route ever touches them or a guarded route accepts a reviewer.

**The inbox** (`/api/admin/review`, filters Everything, Posts, Loop questions, Appeals, Escalated): escalated items first, then the longest waiting.
- **Posts** waiting for review: approve and publish, request changes, reject (a reason is required for the last two).
- **Appeals**: an author's appeal of an organization's hold, showing the organization's reason and the author's reason: lift the hold or keep it (a reason either way).
- **Loop questions**: write the answer (it becomes part of what Loop knows, recorded as approved by a reviewer), or decline with a reason.
- A reviewer on a post's own page can also take a published post down or publish a taken-down one, with a reason.

**Escalation.** A reviewer escalates an item with a reason; the super admin is notified. While escalated, reviewers cannot decide it and it shows "Escalated to a super admin"; the super admin decides it, or sends it back to the reviewers. An item can be escalated once at a time; a super admin has no one to escalate to.

**Trainee posts and organizations.** A trainee's post goes to the central team, not to the organization first. The organization can later keep one of its own trainees' published posts out of public view (`/admin/organization/posts`, "Member posts"), with a reason the trainee reads. The post is hidden from everyone but its author side. The trainee may appeal once for each hold from My posts; a reviewer lifts or keeps it, and if kept it stands until the organization changes it. An organization can only hold posts by its own trainees, never its own.

**Audit.** Posts: `PostReview` (every submission, decision, escalation, hold, appeal, with who, when and why). Loop questions: `ReviewLog`, plus the answer's version history. Authors are notified of decisions.

**Checks.** `scripts/device-checks/review-team.cjs` (needs the app running against a local database).

**Rollback.** Drop `ReviewLog`, the new `Post` and `GuideUnanswered` escalation/appeal columns and `User.canReview` (migration `20261021090000_review_team`). Posts and Loop questions keep working with the super admin as the only decider.

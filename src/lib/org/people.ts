/**
 * Who in a training organization may do what, and how an action is described in the activity log. No database, so it can
 * be tested.
 *
 * The organization owns its courses, examinations and assignments (they are owned by its one internal account), and every
 * person signs in as themselves with their own name and role:
 *   OWNER   the account that registered the organization: everything, including billing and the team.
 *   MANAGER everything except billing. Shown to people as "Admin".
 *   INSTRUCTOR teaches the courses the owner assigns: builds and edits content like an editor, and sees only the trainees and reports of the assigned courses.
 *   EDITOR  builds and edits content and posts; cannot publish, unpublish or delete, change the public profile, billing or team.
 *   VIEWER  can look at everything and cannot change anything.
 */
export type OrgRole = "OWNER" | "MANAGER" | "INSTRUCTOR" | "EDITOR" | "VIEWER";
export const MEMBER_ROLES: Array<Exclude<OrgRole, "OWNER">> = ["MANAGER", "INSTRUCTOR", "EDITOR", "VIEWER"];
export const ROLE_LABEL: Record<OrgRole, string> = { OWNER: "Owner", MANAGER: "Admin", INSTRUCTOR: "Instructor", EDITOR: "Editor", VIEWER: "Viewer" };
export const ROLE_HELP: Record<OrgRole, string> = {
  OWNER: "Everything, including billing and the team.",
  MANAGER: "Everything except billing, including the team.",
  INSTRUCTOR: "Teaches the courses you assign: builds and edits course content and sees only those courses' trainees and reports. Cannot publish, delete, change the public profile, billing or the team.",
  EDITOR: "Builds and edits courses, examinations, assignments and posts. Cannot publish, delete, change the public profile, billing or the team.",
  VIEWER: "Can look at everything. Cannot change anything.",
};
export const isMemberRole = (v: unknown): v is Exclude<OrgRole, "OWNER"> => typeof v === "string" && (MEMBER_ROLES as string[]).includes(v);

const READ = new Set(["GET", "HEAD", "OPTIONS"]);

// A viewer may still sign out, mark notifications read, chat with Loop, and the like: they change nothing about the organization's work.
const VIEWER_ALLOWED_WRITES = [/^\/api\/auth\//, /^\/api\/notifications/, /^\/api\/guide\//, /^\/api\/session\//, /^\/api\/push\//, /^\/api\/analytics\//];

const BILLING = [/^\/api\/org\/billing/, /^\/api\/org\/platform-fee/, /^\/api\/org\/cert-watermark/];
const TEAM_AND_PROFILE = [/^\/api\/org\/members/, /^\/api\/org\/profile/];
const PUBLISH_OR_DELETE = [
  /^\/api\/exams\/[^/]+\/publish$/,
  /^\/api\/admin\/assignments\/[^/]+\/(publish|unpublish)$/,
  /^\/api\/org\/(education-posts|events|programs|posts)\/[^/]+$/, // deleting these (method checked below)
];
const DELETE_TOP_LEVEL = [/^\/api\/courses\/[^/]+$/, /^\/api\/exams\/[^/]+$/, /^\/api\/admin\/assignments\/[^/]+$/];

export function mayDo(role: OrgRole, method: string, path: string): { ok: true } | { ok: false; reason: string } {
  const m = method.toUpperCase();
  if (role === "OWNER") return { ok: true };
  if (READ.has(m)) return { ok: true };
  if (role === "VIEWER") {
    return VIEWER_ALLOWED_WRITES.some((r) => r.test(path)) ? { ok: true } : { ok: false, reason: "You can look at this, but your role cannot change anything. Ask the organization's owner to make you an editor." };
  }
  if (BILLING.some((r) => r.test(path))) return { ok: false, reason: "Only the owner can manage billing." };
  if (role === "MANAGER") return { ok: true };
  // EDITOR
  if (TEAM_AND_PROFILE.some((r) => r.test(path))) return { ok: false, reason: "Only the owner or an admin can change the team or the public profile." };
  if (m === "DELETE" && (DELETE_TOP_LEVEL.some((r) => r.test(path)) || PUBLISH_OR_DELETE[2].test(path))) return { ok: false, reason: "Editors cannot delete. Ask an admin or the owner." };
  if (PUBLISH_OR_DELETE.slice(0, 2).some((r) => r.test(path))) return { ok: false, reason: "Editors cannot publish or unpublish. Ask an admin or the owner." };
  return { ok: true };
}

const NOUNS: Array<[RegExp, string]> = [
  [/^\/api\/courses\/[^/]+\/modules/, "a module"],
  [/^\/api\/courses\/[^/]+\/(curriculum|flyer)/, "course materials"],
  [/^\/api\/courses/, "a course"],
  [/^\/api\/modules/, "a module"],
  [/^\/api\/lessons/, "a lesson"],
  [/^\/api\/materials/, "a material"],
  [/^\/api\/exams\/[^/]+\/publish/, "an examination"],
  [/^\/api\/(exams|questions)/, "an examination"],
  [/^\/api\/admin\/assignments/, "an assignment"],
  [/^\/api\/org\/members/, "the team"],
  [/^\/api\/org\/profile/, "the public profile"],
  [/^\/api\/org\/events/, "an event"],
  [/^\/api\/org\/programs/, "program skills"],
  [/^\/api\/org\/(education-posts|posts)/, "a post"],
  [/^\/api\/posts/, "a post"],
  [/^\/api\/collab/, "sharing"],
  [/^\/api\/admin\/certificate/, "a certificate template"],
];
const VERB: Record<string, string> = { POST: "Created or changed", PUT: "Edited", PATCH: "Edited", DELETE: "Deleted" };

/** A short sentence for the activity list: what kind of thing, and what was done to it. */
export function describeAction(method: string, path: string): string {
  const m = method.toUpperCase();
  const noun = NOUNS.find(([re]) => re.test(path))?.[1] ?? "something";
  if (/\/publish$/.test(path)) return `Published ${noun}`;
  if (/\/unpublish$/.test(path)) return `Unpublished ${noun}`;
  return `${VERB[m] ?? "Changed"} ${noun}`;
}

/** Writes worth recording: changes to the organization's work. Chatting with Loop, reading and signing in are not. */
export function worthLogging(method: string, path: string): boolean {
  if (READ.has(method.toUpperCase())) return false;
  return !/^\/api\/(auth|guide|session|push|notifications|analytics)\b/.test(path);
}

/** Assigned course ids for an instructor, limited to the organization's own courses; null means no limit (everyone else). Pure so it can be tested. */
export function instructorCourseLimit(role: OrgRole, assigned: string[], orgCourseIds: string[]): string[] | null {
  if (role !== "INSTRUCTOR") return null;
  const own = new Set(orgCourseIds);
  return [...new Set(assigned)].filter((id) => own.has(id));
}

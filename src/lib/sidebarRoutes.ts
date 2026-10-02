/**
 * Sidebar rollout (Phase 2) — answers one question: does this exact
 * pathname currently render inside a role's persistent left sidebar
 * (vs. the old plain top header)? Each role's own `src/app/<role>/
 * layout.tsx` answers this for real with a session check; this is a
 * pure, path-only lookup for places that only have the pathname to go
 * on — currently just TourGuideButton.tsx, which decides whether to
 * show its floating button (hidden wherever a sidebar already has its
 * own "Page Help" trigger).
 *
 * Why not read this off SidebarActiveContext instead: TourGuideButton
 * is mounted in the root layout as a SIBLING of `{children}`, not
 * nested inside it — so it sits outside the subtree any role layout's
 * SidebarActiveProvider wraps, and could never see that context's
 * value. A path-based check is the correct mechanism here.
 *
 * Each role's list is its exact pre-auth route segments (login,
 * register, etc.) — those pages have no valid session yet, so they
 * keep the old header regardless of how far the sidebar rollout goes.
 * Instructor has none: every /instructor/* route requires a session,
 * and instructors authenticate entirely through /admin/login instead
 * of a route under /instructor itself.
 */
const PRE_AUTH_SEGMENTS: Record<string, string[]> = {
  admin: ["login", "forgot-password", "reset-password"],
  trainee: ["login", "register", "forgot-password", "reset-password", "verify"],
  employer: ["login", "register"],
  investor: ["login", "register", "reset-password"],
  instructor: [],
};

export function pageHasSidebar(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const role = segments[0];
  if (!role || !(role in PRE_AUTH_SEGMENTS)) return false;
  return !PRE_AUTH_SEGMENTS[role].includes(segments[1] ?? "");
}

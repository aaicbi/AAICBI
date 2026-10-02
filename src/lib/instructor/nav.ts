/**
 * Sidebar rollout (Phase 2) — the one canonical instructor nav list,
 * replacing a `const NAV = [...]` copy-pasted identically across 7
 * pages (no drift found here, unlike employer's — just centralizing,
 * same reasoning as admin/trainee/employer's own nav.ts files).
 */
export const INSTRUCTOR_NAV = [
  { label: "Dashboard", href: "/instructor/dashboard" },
  { label: "My Courses", href: "/instructor/courses" },
  { label: "Teaching Materials", href: "/instructor/materials" },
  { label: "My Payments", href: "/instructor/payments" },
  { label: "Agreement", href: "/instructor/agreement" },
];

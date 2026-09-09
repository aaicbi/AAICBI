/**
 * Personalized landing page — factored out of /admin/settings's own
 * "Admin areas" grid so /admin/dashboard's Quick Actions can reuse the
 * exact same list rather than a second, driftable copy.
 *
 * Settings-page redesign — "Platform-wide settings" removed from this
 * list: it's now a first-class, role-gated "Platform" tab inside
 * /admin/settings itself rather than an external link, so listing it
 * here too would just be the same destination reachable two
 * inconsistent ways. This also incidentally fixes a real, pre-existing
 * gap — this list is shown to any `isApprover` (SUPER_ADMIN or ADMIN)
 * on the dashboard's Quick Actions, but the platform-settings API has
 * always been SUPER_ADMIN-only, so a plain ADMIN clicking it here
 * previously hit a silent, unexplained failure. The standalone
 * `/admin/platform-settings` route itself still works for anyone who
 * already has it bookmarked — only its presence in these two curated
 * lists changes.
 */
export const ADMIN_AREAS = [
  { href: "/admin/employers", label: "Employer accounts", desc: "Review and approve employer registrations" },
  { href: "/admin/job-postings", label: "Job posting review", desc: "Approve or reject submitted job postings" },
  { href: "/admin/testimonials", label: "Testimonials", desc: "Curate trainee reviews shown publicly" },
  { href: "/admin/staff", label: "Staff accounts", desc: "Create and manage staff members" },
  { href: "/admin/trainees", label: "Trainees", desc: "Search and review trainee accounts and profiles" },
  { href: "/admin/reports", label: "Reported profiles", desc: "Review profiles flagged by trainees, staff, or employers" },
];

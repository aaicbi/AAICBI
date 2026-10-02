"use client";
import NotificationBell from "@/components/NotificationBell";

// M32/Stage 6 audit — the bell renders here, not on every individual
// page, since this component already renders on every trainee page in
// the app via each page's own `right={<LogoutButton />}` prop. Adding
// it here means every trainee page gets a real, always-visible
// notification bell "for free," matching the same reach LogoutButton
// itself already has, rather than needing dozens of individual page
// edits to achieve the same coverage.
//
// Sidebar rollout (Phase 2) — QuickActionsNavMenu used to render here
// too, but once its genuinely-unique shortcuts (Ask Loop, My
// Downloads) moved into TRAINEE_NAV itself (now shown directly in the
// sidebar), the dropdown was pure duplication — removed, along with
// the now-dead QuickActionsNavMenu.tsx file. This also now renders
// only inside TraineeSidebar.tsx (SiteHeader is suppressed on every
// other authenticated trainee page), so `align="left"` and
// `justify-between` match that narrow sidebar row rather than the old
// wide top bar.
export default function LogoutButton() {
  return (
    <div className="flex items-center justify-between">
      <NotificationBell align="left" />
      <button
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          // Bug fix — a client-side router.push() here left the
          // sidebar on screen: /trainee/login shares trainee/layout.tsx
          // with every authenticated page, and Next.js doesn't
          // re-render a still-mounted shared layout on navigation
          // between its own sibling routes, so the layout's
          // server-side session check (now stale) never re-ran and the
          // sidebar stayed up over the login form. A hard navigation
          // forces that server check to run fresh, with the
          // just-cleared session cookie.
          window.location.href = "/trainee/login";
        }}
        className="rounded-lg border border-brand-gray px-3 py-2.5 text-sm font-semibold text-gray-600 hover:border-brand-teal"
      >
        Log out
      </button>
    </div>
  );
}
